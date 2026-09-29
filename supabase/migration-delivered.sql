-- =====================================================================
-- Royal Tiara - "Order received" step
--
-- Adds a sixth stage after "Collected by courier": the distributor
-- confirms delivery, and the admin is told.
--
-- Run once: Supabase dashboard -> SQL Editor -> New query -> paste ->
-- Run. Safe to run again.
-- =====================================================================

-- Allow the new fulfilment stage.
alter table public.orders drop constraint if exists orders_fulfil_check;
alter table public.orders add constraint orders_fulfil_check
  check (fulfil in ('packed', 'collected', 'delivered'));

-- The distributor confirms they received their order.
create or replace function public.confirm_receipt(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o  public.orders;
  me public.profiles;
begin
  select * into o from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if o.id is null then
    raise exception 'Order % was not found.', p_order_id;
  end if;
  if o.fulfil is distinct from 'collected' then
    raise exception 'This order is not on its way yet.';
  end if;

  update public.orders
     set fulfil = 'delivered',
         events = events || jsonb_build_object('delivered', now())
   where id = o.id;

  select * into me from public.profiles where id = auth.uid();
  perform public.notify_admins(
    'order',
    coalesce(nullif(me.business, ''), me.name) || ' received ' || o.id,
    'The distributor confirmed delivery.',
    '/admin?tab=sales'
  );
end $$;

revoke execute on function public.confirm_receipt(text) from public, anon;
grant execute on function public.confirm_receipt(text) to authenticated;

-- The admin can also mark it delivered (e.g. told on WhatsApp instead).
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
       set pay_status = 'verified', events = events || jsonb_build_object('verified', now())
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
      'The courier has collected your order.', '/orders/' || o.id);

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
