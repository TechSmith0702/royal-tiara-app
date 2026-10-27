-- Royal Tiara: distributors change the items on an order in the app.
--
-- Until an order is packed for collection:
--   * Not paid yet (no payment, no proof): the distributor edits the items
--     directly (edit_order_items). Royal Tiara is notified.
--   * Paid: the distributor sends a change request (request_order_change);
--     the admin approves or declines it (admin_decide_change). On approval
--     the order takes the new items and total, and:
--       - if more is owed, it goes back to "awaiting payment" for the balance
--         only (card or bank transfer, like any payment);
--       - if less, Royal Tiara owes a refund, which the admin marks as paid
--         back (admin_mark_refunded).
--
-- orders.paid_amount is what has been paid so far, so
--   balance due = total - paid_amount (while unpaid),
--   refund due  = paid_amount - total (when positive).
-- Items already on the order keep the price they were bought at; new items
-- take today's price. An item that went out of stock can stay (at the same
-- quantity or less) but cannot be increased.
--
-- Also: "Packed & ready" is now "Packed for collection"; an order with a
-- payment can no longer be cancelled from the app; an order cannot be packed
-- while a change request is waiting.
--
-- Run after migration-change-delivery.sql. Safe to run more than once.

alter table public.orders add column if not exists paid_amount numeric(10, 2) not null default 0;
alter table public.orders add column if not exists change_request jsonb;
alter table public.orders add column if not exists earlier_proofs jsonb not null default '[]'::jsonb;

-- Orders already paid count as paid in full.
update public.orders set paid_amount = total where pay_status = 'verified' and paid_amount = 0;


-- The lines and subtotal for a new list of items, checked like place_order.
-- Internal: only the functions below call it.
create or replace function public.price_order_items(p_items jsonb, p_old_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  item       jsonb;
  prod       public.products;
  old        jsonb;
  v_variant  int;
  v_qty      int;
  v_price    numeric(10, 2);
  v_size     text;
  v_key      text;
  v_keys     text[] := '{}';
  v_lines    jsonb := '[]'::jsonb;
  v_subtotal numeric(10, 2) := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keep at least one item. To drop the whole order, cancel it instead.';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = item->>'productId';
    if prod.id is null then
      raise exception 'A product in your order is no longer available.';
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

    v_key := prod.id || '/' || coalesce(v_variant::text, '');
    if v_key = any(v_keys) then
      raise exception '% is listed twice.', prod.name;
    end if;
    v_keys := v_keys || v_key;

    -- Already on the order: keep its price; out of stock may stay but not grow.
    select value into old from jsonb_array_elements(coalesce(p_old_lines, '[]'::jsonb))
     where value->>'productId' = prod.id
       and coalesce(value->>'variant', '') = coalesce(v_variant::text, '')
     limit 1;
    if old is not null then
      v_price := (old->>'price')::numeric;
    end if;
    if not prod.in_stock and (old is null or v_qty > (old->>'qty')::int) then
      raise exception '% is out of stock, so it cannot be added or increased.', prod.name;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'productId', prod.id, 'variant', v_variant, 'name', prod.name, 'size', v_size,
      'qty', v_qty, 'price', v_price, 'total', v_price * v_qty
    ));
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  return jsonb_build_object('lines', v_lines, 'subtotal', v_subtotal);
end $$;

revoke execute on function public.price_order_items(jsonb, jsonb) from public, anon, authenticated;


-- Not paid yet: the distributor changes the items straight away.
create or replace function public.edit_order_items(p_order_id text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o      public.orders;
  priced jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.user_id is distinct from auth.uid() then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  if o.fulfil is not null then
    raise exception 'This order is already packed for collection, so it can no longer change. Chat to Royal Tiara.';
  end if;
  if o.pay_status = 'verified' or o.paid_amount > 0 or o.proof is not null then
    raise exception 'This order has a payment, so send a change request instead.';
  end if;

  priced := public.price_order_items(p_items, o.lines);

  update public.orders
     set lines    = priced->'lines',
         subtotal = (priced->>'subtotal')::numeric,
         total    = (priced->>'subtotal')::numeric + delivery,
         events   = events || jsonb_build_object('items_changed', now())
   where id = o.id
  returning * into o;

  perform public.notify_admins('order', 'Order changed · ' || o.id,
    coalesce(nullif(o.business, ''), o.customer) || ' changed the items. New total R'
      || to_char(o.total, 'FM999999990.00') || ' (not paid yet).',
    '/admin?tab=sales');

  return o;
end $$;

revoke execute on function public.edit_order_items(text, jsonb) from public, anon;
grant execute on function public.edit_order_items(text, jsonb) to authenticated;


-- Paid: the distributor asks for the change; the admin decides.
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
  if o.pay_status <> 'verified' and o.paid_amount = 0 then
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


create or replace function public.withdraw_order_change(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  update public.orders set change_request = null
   where id = p_order_id and user_id = auth.uid() and change_request is not null
  returning * into o;
  if o.id is null then
    return;
  end if;
  perform public.notify_admins('order', 'Change withdrawn · ' || o.id,
    coalesce(nullif(o.business, ''), o.customer) || ' withdrew their change request.', '/admin?tab=sales');
end $$;

revoke execute on function public.withdraw_order_change(text) from public, anon;
grant execute on function public.withdraw_order_change(text) to authenticated;


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
         pay_status     = case when v_due > 0 then 'unverified' else 'verified' end,
         -- A balance is paid with a new proof; the earlier one is kept on record.
         earlier_proofs = case when v_due > 0 and proof is not null then earlier_proofs || jsonb_build_array(proof) else earlier_proofs end,
         proof          = case when v_due > 0 then null else proof end,
         events         = (case when v_due > 0 then events - 'proof' - 'verified' else events end)
                          || jsonb_build_object('items_changed', now())
   where id = o.id;

  perform public.notify(o.user_id, 'order', 'Change approved · ' || o.id,
    'New total R' || to_char((r->>'total')::numeric, 'FM999999990.00') || '. '
      || case
           when v_due > 0 then 'Please pay the balance of R' || to_char(v_due, 'FM999999990.00') || ' on the order page.'
           when v_due < 0 then 'Royal Tiara will refund you R' || to_char(-v_due, 'FM999999990.00') || '.'
           else 'There is nothing more to pay.'
         end,
    '/orders/' || o.id);
end $$;

revoke execute on function public.admin_decide_change(text, boolean) from public, anon;
grant execute on function public.admin_decide_change(text, boolean) to authenticated;


create or replace function public.admin_mark_refunded(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o        public.orders;
  v_refund numeric(10, 2);
begin
  if not public.is_admin() then
    raise exception 'Only the admin can update orders.';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  v_refund := o.paid_amount - o.total;
  if v_refund <= 0 then
    return;
  end if;

  update public.orders
     set paid_amount = total,
         events = events || jsonb_build_object('refunded', now(), 'refund_amount', v_refund)
   where id = o.id;

  perform public.notify(o.user_id, 'order', 'Refund sent · ' || o.id,
    'Royal Tiara has refunded you R' || to_char(v_refund, 'FM999999990.00') || '.', '/orders/' || o.id);
end $$;

revoke execute on function public.admin_mark_refunded(text) from public, anon;
grant execute on function public.admin_mark_refunded(text) to authenticated;


-- PayFast confirmations (as in migration-cancel-order.sql), now for the amount
-- still due, so a balance can be paid by card.
create or replace function public.payfast_mark_paid(p_order_id text, p_amount numeric, p_reference text)
returns text language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    return 'unknown order';
  end if;
  if o.pay_status = 'verified' then
    return 'already verified';     -- PayFast may send the same message twice
  end if;
  if round(o.total - o.paid_amount, 2) <> round(p_amount, 2) then
    return 'amount mismatch';
  end if;

  update public.orders
     set pay_status = 'verified',
         pay_method = 'card',
         paid_amount = total,
         fulfil = case when fulfil = 'cancelled' then null else fulfil end,
         events = (events - 'cancelled' - 'cancelled_by') || jsonb_build_object('verified', now(), 'payfast', p_reference)
   where id = p_order_id;

  perform public.notify(o.user_id, 'order', 'Payment received',
    'Your card payment for ' || o.id || ' is confirmed. Royal Tiara is packing your order.', '/orders/' || o.id);
  perform public.notify_admins('order', 'Card payment received',
    o.customer || ' paid ' || case when o.paid_amount > 0 then 'the balance of ' else '' end || o.id || ' by card.'
      || case when o.fulfil = 'cancelled' then ' It had been cancelled, so it is back in Sales.' else '' end,
    '/admin?tab=sales');

  return 'verified';
end $$;

revoke execute on function public.payfast_mark_paid(text, numeric, text) from public, anon, authenticated;


-- cancel_order (as in migration-cancel-order.sql): an order with any payment
-- on it cannot be cancelled from the app.
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
  if o.pay_status = 'verified' or o.paid_amount > 0 or o.fulfil is not null then
    raise exception 'This order is already paid, so it cannot be cancelled here. Chat to Royal Tiara.';
  end if;
  if not by_admin and o.proof is not null then
    raise exception 'You have uploaded a proof of payment for this order. Chat to Royal Tiara to cancel it.';
  end if;

  update public.orders
     set fulfil = 'cancelled',
         change_request = null,
         events = events || jsonb_build_object('cancelled', now(), 'cancelled_by', case when by_admin then 'admin' else 'customer' end)
   where id = o.id;

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


-- admin_advance_order (as in migration-deliver-to-and-tracking.sql), with:
-- verifying records the amount paid; no packing while a change request waits;
-- "Packed for collection" in the message.
create or replace function public.admin_advance_order(p_order_id text, p_step text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can update orders.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Order % was not found.', p_order_id;
  end if;

  if p_step = 'verify' then
    if o.pay_status = 'verified' then return; end if;
    update public.orders
       set pay_status = 'verified',
           paid_amount = total,
           fulfil = case when fulfil = 'cancelled' then null else fulfil end,
           events = (events - 'cancelled' - 'cancelled_by') || jsonb_build_object('verified', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'Payment verified · ' || o.id,
      'Thank you! We are packing your order.', '/orders/' || o.id);

  elsif p_step = 'packed' then
    if o.pay_status <> 'verified' then raise exception 'Verify the payment first.'; end if;
    if o.change_request is not null then raise exception 'Approve or decline the change request first.'; end if;
    if o.fulfil is not null then return; end if;
    update public.orders
       set fulfil = 'packed', events = events || jsonb_build_object('packed', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'Packed for collection · ' || o.id,
      'Your order is packed and waiting for the courier.', '/orders/' || o.id);

  elsif p_step = 'collected' then
    if o.fulfil is distinct from 'packed' then raise exception 'Mark the order packed first.'; end if;
    update public.orders
       set fulfil = 'collected', events = events || jsonb_build_object('collected', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'On its way · ' || o.id,
      'The courier has collected your order.'
        || case when o.tracking_number <> '' then ' Your tracking number is ' || o.tracking_number
             || case when o.courier <> '' then ' (' || o.courier || ')' else '' end || '.' else '' end,
      '/orders/' || o.id);

  elsif p_step = 'delivered' then
    if o.fulfil is distinct from 'collected' then raise exception 'The courier has not collected this order yet.'; end if;
    update public.orders
       set fulfil = 'delivered', events = events || jsonb_build_object('delivered', now())
     where id = o.id;

  else
    raise exception 'Unknown order step: %', p_step;
  end if;
end $$;

revoke execute on function public.admin_advance_order(text, text) from public, anon;
grant execute on function public.admin_advance_order(text, text) to authenticated;
