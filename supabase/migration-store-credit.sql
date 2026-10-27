-- Royal Tiara: money owed to a distributor carries over to their next order.
--
-- When a paid order changes to a smaller total (admin approves the change),
-- the difference is not refunded: it is added to profiles.credit, shown to
-- the distributor as "Amount payable to you". Their next order uses it up
-- automatically (orders.credit_used); if it covers the whole order, the
-- order is paid straight away. Cancelling an unpaid order gives it back.
--
-- "Real" money paid on an order is paid_amount - credit_used. Orders paid
-- only from credit can still be edited directly or cancelled, like unpaid ones.
--
-- Run after migration-order-changes.sql. Safe to run more than once.

alter table public.profiles add column if not exists credit numeric(10, 2) not null default 0;
alter table public.orders add column if not exists credit_used numeric(10, 2) not null default 0;

do $$
begin
  alter table public.profiles add constraint profiles_credit_check check (credit >= 0);
exception when duplicate_object then null;
end $$;

-- Distributors can read their own credit but never change it: profiles only
-- grants update on name, business, phone and address (schema.sql).


-- place_order as in migration-recipient-email.sql, plus the credit.
create or replace function public.place_order(
  p_items jsonb, p_pay_method text, p_proof jsonb default null, p_deliver jsonb default null
)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  me         public.profiles;
  item       jsonb;
  prod       public.products;
  v_variant  int;
  v_qty      int;
  v_price    numeric(10, 2);
  v_size     text;
  v_lines    jsonb := '[]'::jsonb;
  v_subtotal numeric(10, 2) := 0;
  v_delivery numeric(10, 2);
  v_seq      bigint;
  v_now      timestamptz := now();
  v_proof    jsonb := case when p_pay_method = 'eft' then p_proof end;
  v_order    public.orders;
  v_other    boolean := false;
  v_name     text := '';
  v_phone    text := '';
  v_email    text := '';
  v_method   text := 'door';
  v_point    text := '';
  v_line1    text;
  v_line2    text;
  v_credit   numeric(10, 2) := 0;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null or me.role <> 'distributor' or me.status <> 'approved' then
    raise exception 'Your trade account is not active yet.';
  end if;
  if p_pay_method is null or p_pay_method not in ('eft', 'card') then
    raise exception 'Choose a payment method.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if not public.valid_proof(v_proof) then
    raise exception 'That proof of payment file is not valid.';
  end if;

  -- Where it goes: the account's own address, or details typed for this order.
  v_line1 := me.address_line1;
  v_line2 := me.address_line2;
  if p_deliver is not null and jsonb_typeof(p_deliver) = 'object' and p_deliver <> '{}'::jsonb then
    v_other  := true;
    v_name   := btrim(coalesce(p_deliver->>'name', ''));
    v_phone  := btrim(coalesce(p_deliver->>'phone', ''));
    v_email  := lower(btrim(coalesce(p_deliver->>'email', '')));
    v_method := coalesce(nullif(btrim(p_deliver->>'method'), ''), 'door');
    if v_method not in ('door', 'pudo', 'paxi') then raise exception 'Choose how the order is delivered.'; end if;
    if v_name = '' then raise exception 'Type the name of the person receiving the order.'; end if;
    if v_phone !~ '^\+?[0-9 ()-]{9,20}$' then raise exception 'Type a phone number for the person receiving the order.'; end if;
    if length(v_name) > 80 then raise exception 'The name is too long.'; end if;
    if v_email <> '' and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 120) then
      raise exception 'That email address does not look right.';
    end if;

    if v_method = 'door' then
      v_line1 := btrim(coalesce(p_deliver->>'line1', ''));
      v_line2 := btrim(coalesce(p_deliver->>'line2', ''));
      if v_line1 = '' then raise exception 'Type the delivery address.'; end if;
      if v_line2 = '' then raise exception 'Type the suburb, city, province and postal code.'; end if;
      if length(v_line1) > 160 or length(v_line2) > 160 then raise exception 'The delivery address is too long.'; end if;
    else
      v_point := btrim(coalesce(p_deliver->>'point', ''));
      if v_point = '' then
        raise exception 'Type the % they will collect from.', case when v_method = 'pudo' then 'PUDO locker' else 'PAXI point' end;
      end if;
      if length(v_point) > 160 then raise exception 'The pickup point is too long.'; end if;
      v_line1 := '';
      v_line2 := '';
    end if;
  elsif coalesce(btrim(me.address_line1), '') = '' then
    raise exception 'Your account has no delivery address. Ask Royal Tiara to add it, or deliver to someone else.';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = item->>'productId';
    if prod.id is null then
      raise exception 'A product in your cart is no longer available.';
    end if;
    if not prod.in_stock then
      raise exception '% is out of stock. Remove it to check out.', prod.name;
    end if;

    v_qty := (item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'Check the quantity for %.', prod.name;
    end if;

    if prod.variants is not null then
      v_variant := coalesce((item->>'variant')::int, 0);
      if v_variant < 0 or v_variant >= jsonb_array_length(prod.variants) then
        raise exception 'Choose a size for %.', prod.name;
      end if;
      v_price := (prod.variants->v_variant->>'price')::numeric;
      v_size  := prod.variants->v_variant->>'label';
    else
      v_variant := null;
      v_price   := prod.price;
      v_size    := prod.sub;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'productId', prod.id, 'variant', v_variant, 'name', prod.name, 'size', v_size,
      'qty', v_qty, 'price', v_price, 'total', v_price * v_qty
    ));
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  select coalesce(delivery_fee, 90) into v_delivery from public.settings where id = true;
  v_delivery := coalesce(v_delivery, 90);

  -- Money Royal Tiara owes the distributor ("amount payable to you") comes
  -- off this order first. If it covers everything, the order is paid.
  v_credit := least(coalesce(me.credit, 0), v_subtotal + v_delivery);
  if v_credit > 0 then
    update public.profiles set credit = credit - v_credit where id = me.id;
  end if;

  v_seq := nextval('public.order_seq');

  insert into public.orders (
    id, invoice, user_id, customer, business, address_line1, address_line2, lines,
    subtotal, delivery, total, pay_method, proof, pay_status, events,
    deliver_to, recipient_name, recipient_phone, recipient_email, delivery_method, pickup_point,
    credit_used, paid_amount
  ) values (
    'RT-' || v_seq, 'INV-' || v_seq, me.id, me.name, me.business, v_line1, v_line2, v_lines,
    v_subtotal, v_delivery, v_subtotal + v_delivery, p_pay_method, v_proof,
    case when v_credit > 0 and v_credit >= v_subtotal + v_delivery then 'verified' else 'unverified' end,
    jsonb_build_object('placed', v_now, 'proof', case when p_pay_method = 'card' or v_proof is not null then v_now end)
      || case when v_credit > 0 and v_credit >= v_subtotal + v_delivery then jsonb_build_object('verified', v_now) else '{}'::jsonb end,
    case when v_other then 'other' else 'me' end, v_name, v_phone, v_email, v_method, v_point,
    v_credit, v_credit
  )
  returning * into v_order;

  perform public.notify_admins(
    'order',
    'New order ' || v_order.id,
    coalesce(nullif(me.business, ''), me.name) || ' · R' || to_char(v_order.total, 'FM999999990.00')
      || case
           when v_credit > 0 and v_credit >= v_order.total then ' · paid from amount owed to them'
           when p_pay_method = 'card' then ' · card'
           when v_proof is not null then ' · proof attached'
           else ' · awaiting proof'
         end
      || case when v_credit > 0 and v_credit < v_order.total then ' (R' || to_char(v_credit, 'FM999999990.00') || ' from amount owed to them)' else '' end
      || case when v_other then ' · deliver to ' || v_name
           || case v_method when 'pudo' then ' (PUDO locker)' when 'paxi' then ' (PAXI point)' else '' end
         else '' end,
    '/admin?tab=sales'
  );

  return v_order;
end $$;

revoke execute on function public.place_order(jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, text, jsonb, jsonb) to authenticated;


-- edit_order_items (migration-order-changes.sql): also for orders paid only
-- from credit, which is re-worked out for the new total.
create or replace function public.edit_order_items(p_order_id text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o           public.orders;
  priced      jsonb;
  v_total     numeric(10, 2);
  v_available numeric(10, 2);
  v_used      numeric(10, 2);
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.user_id is distinct from auth.uid() then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  if o.fulfil is not null then
    raise exception 'This order is already packed for collection, so it can no longer change. Chat to Royal Tiara.';
  end if;
  if o.paid_amount - o.credit_used > 0 or o.proof is not null then
    raise exception 'This order has a payment, so send a change request instead.';
  end if;

  priced  := public.price_order_items(p_items, o.lines);
  v_total := (priced->>'subtotal')::numeric + o.delivery;

  -- Credit already on this order plus what is left on the account.
  select o.credit_used + credit into v_available from public.profiles where id = o.user_id for update;
  v_used := least(coalesce(v_available, o.credit_used), v_total);
  update public.profiles set credit = coalesce(v_available, o.credit_used) - v_used where id = o.user_id;

  update public.orders
     set lines       = priced->'lines',
         subtotal    = (priced->>'subtotal')::numeric,
         total       = v_total,
         credit_used = v_used,
         paid_amount = v_used,
         pay_status  = case when v_used > 0 and v_used >= v_total then 'verified' else 'unverified' end,
         events      = (case when v_used > 0 and v_used >= v_total then events || jsonb_build_object('verified', now()) else events - 'verified' end)
                       || jsonb_build_object('items_changed', now())
   where id = o.id
  returning * into o;

  perform public.notify_admins('order', 'Order changed · ' || o.id,
    coalesce(nullif(o.business, ''), o.customer) || ' changed the items. New total R'
      || to_char(o.total, 'FM999999990.00')
      || case when o.pay_status = 'verified' then ' (paid from amount owed to them).' else ' (not paid yet).' end,
    '/admin?tab=sales');

  return o;
end $$;

revoke execute on function public.edit_order_items(text, jsonb) from public, anon;
grant execute on function public.edit_order_items(text, jsonb) to authenticated;


-- request_order_change (migration-order-changes.sql): only for orders with
-- real money paid; orders paid from credit alone are edited directly.
create or replace function public.request_order_change(p_order_id text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o       public.orders;
  priced  jsonb;
  v_total numeric(10, 2);
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.user_id is distinct from auth.uid() then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  if o.fulfil is not null then
    raise exception 'This order is already packed for collection, so it can no longer change. Chat to Royal Tiara.';
  end if;
  if o.paid_amount - o.credit_used <= 0 then
    raise exception 'This order is not paid yet, so you can change the items directly.';
  end if;
  if o.pay_status <> 'verified' and o.proof is not null then
    raise exception 'Royal Tiara is still checking your payment. Try again once it is verified.';
  end if;

  priced  := public.price_order_items(p_items, o.lines);
  v_total := (priced->>'subtotal')::numeric + o.delivery;

  update public.orders
     set change_request = jsonb_build_object(
           'lines', priced->'lines',
           'subtotal', (priced->>'subtotal')::numeric,
           'total', v_total,
           'requested_at', now())
   where id = o.id
  returning * into o;

  perform public.notify_admins('order', 'Change requested · ' || o.id,
    coalesce(nullif(o.business, ''), o.customer) || ' asks to change the items: R'
      || to_char(o.total, 'FM999999990.00') || ' becomes R' || to_char(v_total, 'FM999999990.00') || '.',
    '/admin?tab=sales');

  return o;
end $$;

revoke execute on function public.request_order_change(text, jsonb) from public, anon;
grant execute on function public.request_order_change(text, jsonb) to authenticated;


-- admin_decide_change (migration-order-changes.sql): an overpayment becomes
-- "amount payable to you" for the next order instead of a refund.
create or replace function public.admin_decide_change(p_order_id text, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  o     public.orders;
  r     jsonb;
  v_due numeric(10, 2);
begin
  if not public.is_admin() then
    raise exception 'Only the admin can update orders.';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  r := o.change_request;
  if r is null then
    return;
  end if;

  if not p_approve then
    update public.orders set change_request = null where id = o.id;
    perform public.notify(o.user_id, 'order', 'Change declined · ' || o.id,
      'Royal Tiara could not make that change, so your order stays as it was. Chat to us for details.', '/orders/' || o.id);
    return;
  end if;

  if o.fulfil is not null then
    raise exception 'This order is already packed, so the change can no longer be made.';
  end if;

  v_due := (r->>'total')::numeric - o.paid_amount;

  update public.orders
     set lines          = r->'lines',
         subtotal       = (r->>'subtotal')::numeric,
         total          = (r->>'total')::numeric,
         change_request = null,
         -- Overpaid: the order counts as paid in full; the rest goes to credit.
         paid_amount    = case when v_due < 0 then (r->>'total')::numeric else paid_amount end,
         pay_status     = case when v_due > 0 then 'unverified' else 'verified' end,
         earlier_proofs = case when v_due > 0 and proof is not null then earlier_proofs || jsonb_build_array(proof) else earlier_proofs end,
         proof          = case when v_due > 0 then null else proof end,
         events         = (case when v_due > 0 then events - 'proof' - 'verified' else events end)
                          || jsonb_build_object('items_changed', now())
                          || case when v_due < 0 then jsonb_build_object('credit_added', -v_due) else '{}'::jsonb end
   where id = o.id;

  if v_due < 0 and o.user_id is not null then
    update public.profiles set credit = credit + (-v_due) where id = o.user_id;
  end if;

  perform public.notify(o.user_id, 'order', 'Change approved · ' || o.id,
    'New total R' || to_char((r->>'total')::numeric, 'FM999999990.00') || '. '
      || case
           when v_due > 0 then 'Please pay the balance of R' || to_char(v_due, 'FM999999990.00') || ' on the order page.'
           when v_due < 0 then 'R' || to_char(-v_due, 'FM999999990.00') || ' is payable to you and comes off your next order.'
           else 'There is nothing more to pay.'
         end,
    '/orders/' || o.id);
end $$;

revoke execute on function public.admin_decide_change(text, boolean) from public, anon;
grant execute on function public.admin_decide_change(text, boolean) to authenticated;


-- cancel_order (migration-order-changes.sql): orders paid only from credit can
-- be cancelled too, and the credit goes back to the account.
create or replace function public.cancel_order(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  by_admin boolean := public.is_admin();
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or (not by_admin and o.user_id is distinct from auth.uid()) then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  if o.fulfil = 'cancelled' then
    return;
  end if;
  if o.paid_amount - o.credit_used > 0 or o.fulfil is not null then
    raise exception 'This order is already paid, so it cannot be cancelled here. Chat to Royal Tiara.';
  end if;
  if not by_admin and o.proof is not null then
    raise exception 'You have uploaded a proof of payment for this order. Chat to Royal Tiara to cancel it.';
  end if;

  update public.orders
     set fulfil = 'cancelled',
         change_request = null,
         pay_status = 'unverified',
         paid_amount = 0,
         credit_used = 0,
         events = (events - 'verified') || jsonb_build_object('cancelled', now(), 'cancelled_by', case when by_admin then 'admin' else 'customer' end)
                  || case when o.credit_used > 0 then jsonb_build_object('credit_returned', o.credit_used) else '{}'::jsonb end
   where id = o.id;

  if o.credit_used > 0 and o.user_id is not null then
    update public.profiles set credit = credit + o.credit_used where id = o.user_id;
  end if;

  if by_admin then
    perform public.notify(o.user_id, 'order', 'Order cancelled · ' || o.id,
      'Royal Tiara cancelled this unpaid order. Chat to us if you still need it.', '/orders/' || o.id);
  else
    perform public.notify_admins('order', 'Order cancelled · ' || o.id,
      coalesce(nullif(o.business, ''), o.customer) || ' cancelled this unpaid order.', '/admin?tab=sales');
  end if;
end $$;

revoke execute on function public.cancel_order(text) from public, anon;
grant execute on function public.cancel_order(text) to authenticated;
