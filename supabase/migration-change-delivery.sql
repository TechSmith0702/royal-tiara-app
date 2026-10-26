-- Royal Tiara: the distributor can change where an order goes until it is
-- packed: Me / Someone else, and door / PUDO locker / PAXI point.
-- The total does not change (one delivery fee for every option).
--
-- Run after migration-recipient-email.sql. Safe to run more than once.

create or replace function public.change_delivery(p_order_id text, p_deliver jsonb default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o        public.orders;
  me       public.profiles;
  v_other  boolean := false;
  v_name   text := '';
  v_phone  text := '';
  v_email  text := '';
  v_method text := 'door';
  v_point  text := '';
  v_line1  text;
  v_line2  text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.user_id is distinct from auth.uid() then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  -- Packed (or collected, delivered, cancelled): the parcel may already be labelled.
  if o.fulfil is not null then
    raise exception 'This order is already packed, so the delivery can no longer change. Chat to Royal Tiara.';
  end if;

  select * into me from public.profiles where id = auth.uid();

  -- The same checks as place_order (migration-recipient-email.sql).
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
    raise exception 'Your account has no delivery address. Choose "Someone else".';
  end if;

  update public.orders
     set deliver_to      = case when v_other then 'other' else 'me' end,
         recipient_name  = v_name,
         recipient_phone = v_phone,
         recipient_email = v_email,
         delivery_method = v_method,
         pickup_point    = v_point,
         address_line1   = v_line1,
         address_line2   = v_line2,
         events          = events || jsonb_build_object('delivery_changed', now())
   where id = o.id
  returning * into o;

  perform public.notify_admins(
    'order',
    'Delivery changed · ' || o.id,
    coalesce(nullif(me.business, ''), me.name) || ' now sends it to '
      || case when v_other then v_name else 'their own address' end
      || case v_method when 'pudo' then ' (PUDO locker)' when 'paxi' then ' (PAXI point)' else '' end,
    '/admin?tab=sales'
  );

  return o;
end $$;

revoke execute on function public.change_delivery(text, jsonb) from public, anon;
grant execute on function public.change_delivery(text, jsonb) to authenticated;