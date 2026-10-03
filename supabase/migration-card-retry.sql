-- A card payment that was cancelled or failed is no longer a dead end.
--
-- The distributor can now pay by card again (the app sends them back to
-- PayFast with the same order), or switch the order to bank transfer and
-- upload a proof of payment like any EFT order.
-- Safe to run more than once.

create or replace function public.switch_to_eft(p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  update public.orders
     set pay_method = 'eft',
         events = events - 'proof'      -- card orders count as "submitted" at checkout
   where id = p_order_id and user_id = auth.uid() and pay_method = 'card' and pay_status = 'unverified'
  returning * into o;

  if o.id is null then
    raise exception 'This order can no longer be switched to bank transfer.';
  end if;

  perform public.notify_admins('order', 'Switched to bank transfer · ' || o.id,
    coalesce(nullif(o.business, ''), o.customer) || ' will pay by EFT instead of card.', '/admin?tab=sales');
end $$;

revoke execute on function public.switch_to_eft(text) from public, anon;
grant execute on function public.switch_to_eft(text) to authenticated;


-- PayFast confirms a payment. Previously only card orders were accepted, but
-- a distributor may switch to bank transfer and then finish a card payment in
-- a PayFast tab they still had open. The money arrived either way, so any
-- unpaid order with the right amount is marked paid (and becomes a card order).
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
         events = events || jsonb_build_object('verified', now(), 'payfast', p_reference)
   where id = p_order_id;

  perform public.notify(o.user_id, 'order', 'Payment received',
    'Your card payment for ' || o.id || ' is confirmed. Royal Tiara is packing your order.', '/orders/' || o.id);
  perform public.notify_admins('order', 'Card payment received',
    o.customer || ' paid ' || o.id || ' by card.', '/admin?tab=sales');

  return 'verified';
end $$;

revoke execute on function public.payfast_mark_paid(text, numeric, text) from public, anon, authenticated;
