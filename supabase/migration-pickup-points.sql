-- Royal Tiara: "Anyone else" orders can go to a door (The Courier Guy) or to
-- a pickup point: a PUDO locker or a PAXI point (PEP / Tekkie Town store).
--
-- orders.delivery_method is 'door', 'pudo' or 'paxi'. For a pickup point the
-- locker or store the distributor chose is in orders.pickup_point, and the
-- address lines are left empty. "Me" orders always go to the account's
-- address by The Courier Guy (door).
--
-- Run after migration-deliver-to-and-tracking.sql. Safe to run more than once.

alter table public.orders add column if not exists delivery_method text not null default 'door';
alter table public.orders add column if not exists pickup_point text not null default '';

do $$
begin
  alter table public.orders add constraint orders_delivery_method_check check (delivery_method in ('door', 'pudo', 'paxi'));
exception when duplicate_object then null;
end $$;


-- place_order as in migration-deliver-to-and-tracking.sql, plus the delivery
-- method. p_deliver for someone else is
--   {"name", "phone", "method": "door", "line1", "line2"}  or
--   {"name", "phone", "method": "pudo" | "paxi", "point"}
-- A missing method means "door", so older copies of the app keep working.
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
  v_method   text := 'door';
  v_point    text := '';
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

  -- Where it goes: the account's own address, or details typed for this order.
  v_line1 := me.address_line1;
  v_line2 := me.address_line2;
  if p_deliver is not null and jsonb_typeof(p_deliver) = 'object' and p_deliver <> '{}'::jsonb then
    v_other  := true;
    v_name   := btrim(coalesce(p_deliver->>'name', ''));
    v_phone  := btrim(coalesce(p_deliver->>'phone', ''));
    v_method := coalesce(nullif(btrim(p_deliver->>'method'), ''), 'door');
    if v_method not in ('door', 'pudo', 'paxi') then raise exception 'Choose how the order is delivered.'; end if;
    if v_name = '' then raise exception 'Type the name of the person receiving the order.'; end if;
    if v_phone !~ '^\+?[0-9 ()-]{9,20}$' then raise exception 'Type a phone number for the person receiving the order.'; end if;
    if length(v_name) > 80 then raise exception 'The name is too long.'; end if;

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

  v_seq := nextval('public.order_seq');

  insert into public.orders (
    id, invoice, user_id, customer, business, address_line1, address_line2, lines,
    subtotal, delivery, total, pay_method, proof, pay_status, events,
    deliver_to, recipient_name, recipient_phone, delivery_method, pickup_point
  ) values (
    'RT-' || v_seq, 'INV-' || v_seq, me.id, me.name, me.business, v_line1, v_line2, v_lines,
    v_subtotal, v_delivery, v_subtotal + v_delivery, p_pay_method, v_proof, 'unverified',
    jsonb_build_object('placed', v_now, 'proof', case when p_pay_method = 'card' or v_proof is not null then v_now end),
    case when v_other then 'other' else 'me' end, v_name, v_phone, v_method, v_point
  )
  returning * into v_order;

  perform public.notify_admins(
    'order',
    'New order ' || v_order.id,
    coalesce(nullif(me.business, ''), me.name) || ' · R' || to_char(v_order.total, 'FM999999990.00')
      || case when p_pay_method = 'card' then ' · card' when v_proof is not null then ' · proof attached' else ' · awaiting proof' end
      || case when v_other then ' · deliver to ' || v_name
           || case v_method when 'pudo' then ' (PUDO locker)' when 'paxi' then ' (PAXI point)' else '' end
         else '' end,
    '/admin?tab=sales'
  );

  return v_order;
end $$;

revoke execute on function public.place_order(jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, text, jsonb, jsonb) to authenticated;
