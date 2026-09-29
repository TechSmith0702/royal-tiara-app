-- Marks a card order as paid when PayFast confirms it (the "ITN" callback).
--
-- Only the Edge Function may call this: it runs with the service_role key,
-- which nobody in the app has. The function refuses to confirm an order whose
-- total does not match what PayFast says was paid.
-- Safe to run more than once.

create or replace function public.payfast_mark_paid(p_order_id text, p_amount numeric, p_reference text)
returns text language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    return 'unknown order';
  end if;
  if o.pay_method <> 'card' then
    return 'not a card order';
  end if;
  if o.pay_status = 'verified' then
    return 'already verified';     -- PayFast may send the same message twice
  end if;
  if round(o.total, 2) <> round(p_amount, 2) then
    return 'amount mismatch';
  end if;

  update public.orders
     set pay_status = 'verified',
         events = events || jsonb_build_object('verified', now(), 'payfast', p_reference)
   where id = p_order_id;

  perform public.notify(o.user_id, 'order', 'Payment received',
    'Your card payment for ' || o.id || ' is confirmed. Royal Tiara is packing your order.', '/orders');
  perform public.notify_admins('order', 'Card payment received',
    o.customer || ' paid ' || o.id || ' by card.', '/admin?tab=sales');

  return 'verified';
end $$;

-- Nobody in the app can call it: only the service_role key used by the
-- Edge Function, which bypasses these grants.
revoke execute on function public.payfast_mark_paid(text, numeric, text) from public, anon, authenticated;
