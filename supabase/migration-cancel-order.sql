-- Cancelling unpaid orders.
--
-- A distributor can cancel their own order while it is unpaid and they have
-- not uploaded a proof of payment (after that they may already have paid, so
-- they ask Royal Tiara). The admin can cancel any unpaid order. A cancelled
-- order is kept, marked "cancelled", and no longer counts as open.
--
-- If money arrives for a cancelled order anyway (a PayFast payment finishing
-- late, or a transfer the admin verifies), the order is reinstated and paid.
-- Safe to run more than once.


-- ---------------------------------------------------------------------
-- "cancelled" joins the fulfilment stages.
-- ---------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_fulfil_check;
alter table public.orders add constraint orders_fulfil_check
  check (fulfil in ('packed', 'collected', 'delivered', 'cancelled'));


-- ---------------------------------------------------------------------
-- The action behind "Cancel this order" (distributor) and "Cancel order"
-- (admin).
-- ---------------------------------------------------------------------
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
  if o.pay_status = 'verified' or o.fulfil is not null then
    raise exception 'This order is already paid, so it cannot be cancelled here. Chat to Royal Tiara.';
  end if;
  if not by_admin and o.proof is not null then
    raise exception 'You have uploaded a proof of payment for this order. Chat to Royal Tiara to cancel it.';
  end if;

  update public.orders
     set fulfil = 'cancelled',
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


-- ---------------------------------------------------------------------
-- A cancelled order takes no proof and cannot switch payment method.
-- ---------------------------------------------------------------------
create or replace function public.attach_proof(p_order_id text, p_proof jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_proof is null or not public.valid_proof(p_proof) then
    raise exception 'That proof of payment file is not valid.';
  end if;

  update public.orders
     set proof = p_proof,
         events = events || jsonb_build_object('proof', now())
   where id = p_order_id and user_id = auth.uid() and pay_method = 'eft' and pay_status = 'unverified'
     and fulfil is null;

  if not found then
    raise exception 'This order can no longer take a proof of payment.';
  end if;

  perform public.notify_admins('proof', 'Proof of payment · ' || p_order_id,
    'Check the bank account and verify the payment.', '/admin?tab=sales');
end $$;

create or replace function public.switch_to_eft(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  update public.orders
     set pay_method = 'eft',
         events = events - 'proof'      -- card orders count as "submitted" at checkout
   where id = p_order_id and user_id = auth.uid() and pay_method = 'card' and pay_status = 'unverified'
     and fulfil is null
  returning * into o;

  if o.id is null then
    raise exception 'This order can no longer be switched to bank transfer.';
  end if;

  perform public.notify_admins('order', 'Switched to bank transfer · ' || o.id,
    coalesce(nullif(o.business, ''), o.customer) || ' will pay by EFT instead of card.', '/admin?tab=sales');
end $$;


-- ---------------------------------------------------------------------
-- Money for a cancelled order reinstates it. Same as before otherwise.
-- ---------------------------------------------------------------------
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
  if round(o.total, 2) <> round(p_amount, 2) then
    return 'amount mismatch';
  end if;

  update public.orders
     set pay_status = 'verified',
         pay_method = 'card',
         fulfil = case when fulfil = 'cancelled' then null else fulfil end,
         events = (events - 'cancelled' - 'cancelled_by') || jsonb_build_object('verified', now(), 'payfast', p_reference)
   where id = p_order_id;

  perform public.notify(o.user_id, 'order', 'Payment received',
    'Your card payment for ' || o.id || ' is confirmed. Royal Tiara is packing your order.', '/orders/' || o.id);
  perform public.notify_admins('order', 'Card payment received',
    o.customer || ' paid ' || o.id || ' by card.'
      || case when o.fulfil = 'cancelled' then ' It had been cancelled, so it is back in Sales.' else '' end,
    '/admin?tab=sales');

  return 'verified';
end $$;

revoke execute on function public.payfast_mark_paid(text, numeric, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- The admin verifying a payment also reinstates a cancelled order. The other
-- steps are unchanged.
-- ---------------------------------------------------------------------
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
