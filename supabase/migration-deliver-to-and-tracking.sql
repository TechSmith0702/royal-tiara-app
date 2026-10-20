-- Royal Tiara: "Deliver to" choice at checkout, and courier tracking numbers.
--
-- 1. At checkout a distributor delivers either to themselves (the address on
--    their account, which cannot be changed at checkout) or to someone else
--    (a name, phone number and address typed for that order only).
--    The order's address_line1/2 always hold the delivery address.
-- 2. The admin can save the courier and tracking number on an order, before
--    or after marking it collected. The distributor sees "Your tracking
--    number is ..." on the order.
--
-- Safe to run more than once.

alter table public.orders add column if not exists deliver_to text not null default 'me';
alter table public.orders add column if not exists recipient_name text not null default '';
alter table public.orders add column if not exists recipient_phone text not null default '';
alter table public.orders add column if not exists courier text not null default '';
alter table public.orders add column if not exists tracking_number text not null default '';

do $$
begin
  alter table public.orders add constraint orders_deliver_to_check check (deliver_to in ('me', 'other'));
exception when duplicate_object then null;
end $$;


-- place_order with an optional delivery choice. p_deliver is null or {} for
-- "me", or {"name", "phone", "line1", "line2"} for someone else.
-- Older copies of the app still call it with three arguments, which works:
-- the fourth defaults to "me".
drop function if exists public.place_order(jsonb, text, jsonb);

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
  v_line1    text;
  v_line2    text;
begin
  select * into me from public.profiles where id = auth.uid();
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

  -- Where it goes: the account's own address, or one typed for this order.
  v_line1 := me.address_line1;
  v_line2 := me.address_line2;
  if p_deliver is not null and jsonb_typeof(p_deliver) = 'object' and p_deliver <> '{}'::jsonb then
    v_other := true;
    v_name  := btrim(coalesce(p_deliver->>'name', ''));
    v_phone := btrim(coalesce(p_deliver->>'phone', ''));
    v_line1 := btrim(coalesce(p_deliver->>'line1', ''));
    v_line2 := btrim(coalesce(p_deliver->>'line2', ''));
    if v_name = '' then raise exception 'Type the name of the person receiving the order.'; end if;
    if v_phone !~ '^\+?[0-9 ()-]{9,20}$' then raise exception 'Type a phone number for the person receiving the order.'; end if;
    if v_line1 = '' then raise exception 'Type the delivery address.'; end if;
    if v_line2 = '' then raise exception 'Type the town, province and postal code.'; end if;
    if length(v_name) > 80 or length(v_line1) > 160 or length(v_line2) > 160 then
      raise exception 'The delivery details are too long.';
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

  v_seq := nextval('public.order_seq');

  insert into public.orders (
    id, invoice, user_id, customer, business, address_line1, address_line2, lines,
    subtotal, delivery, total, pay_method, proof, pay_status, events,
    deliver_to, recipient_name, recipient_phone
  ) values (
    'RT-' || v_seq, 'INV-' || v_seq, me.id, me.name, me.business, v_line1, v_line2, v_lines,
    v_subtotal, v_delivery, v_subtotal + v_delivery, p_pay_method, v_proof, 'unverified',
    jsonb_build_object('placed', v_now, 'proof', case when p_pay_method = 'card' or v_proof is not null then v_now end),
    case when v_other then 'other' else 'me' end, v_name, v_phone
  )
  returning * into v_order;

  perform public.notify_admins(
    'order',
    'New order ' || v_order.id,
    coalesce(nullif(me.business, ''), me.name) || ' · R' || to_char(v_order.total, 'FM999999990.00')
      || case when p_pay_method = 'card' then ' · card' when v_proof is not null then ' · proof attached' else ' · awaiting proof' end
      || case when v_other then ' · deliver to ' || v_name else '' end,
    '/admin?tab=sales'
  );

  return v_order;
end $$;

revoke execute on function public.place_order(jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, text, jsonb, jsonb) to authenticated;


-- The admin saves the courier and tracking number. Allowed until delivery.
-- If the order is already on its way, the distributor is told the number.
create or replace function public.admin_set_tracking(p_order_id text, p_courier text, p_tracking text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o          public.orders;
  v_courier  text := btrim(coalesce(p_courier, ''));
  v_tracking text := btrim(coalesce(p_tracking, ''));
begin
  if not public.is_admin() then
    raise exception 'Only the admin can update orders.';
  end if;
  if length(v_courier) > 60 or length(v_tracking) > 60 then
    raise exception 'The courier or tracking number is too long.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  if o.fulfil = 'cancelled' then
    raise exception 'This order was cancelled.';
  end if;
  if o.courier = v_courier and o.tracking_number = v_tracking then
    return;
  end if;

  update public.orders set courier = v_courier, tracking_number = v_tracking where id = o.id;

  if o.fulfil in ('collected', 'delivered') and v_tracking <> '' then
    perform public.notify(o.user_id, 'order', 'Tracking number · ' || o.id,
      'Your tracking number is ' || v_tracking || case when v_courier <> '' then ' (' || v_courier || ')' else '' end || '.',
      '/orders/' || o.id);
  end if;
end $$;

revoke execute on function public.admin_set_tracking(text, text, text) from public, anon;
grant execute on function public.admin_set_tracking(text, text, text) to authenticated;


-- admin_advance_order as before (migration-cancel-order.sql); the
-- "collected" message now includes the tracking number when there is one.
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
           fulfil = case when fulfil = 'cancelled' then null else fulfil end,
           events = (events - 'cancelled' - 'cancelled_by') || jsonb_build_object('verified', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'Payment verified · ' || o.id,
      'Thank you! We are packing your order.', '/orders/' || o.id);

  elsif p_step = 'packed' then
    if o.pay_status <> 'verified' then raise exception 'Verify the payment first.'; end if;
    if o.fulfil is not null then return; end if;
    update public.orders
       set fulfil = 'packed', events = events || jsonb_build_object('packed', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'Packed & ready · ' || o.id,
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
