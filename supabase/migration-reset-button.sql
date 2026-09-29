-- =====================================================================
-- Royal Tiara - "Clear test data" button for the admin console
--
-- Run once: Supabase dashboard -> SQL Editor -> New query -> paste ->
-- Run. Safe to run again.
--
-- This lets the admin wipe orders, chat and notifications from inside
-- the app while testing. Accounts and the catalogue are kept.
-- =====================================================================

create or replace function public.admin_reset_test_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_orders int;
  v_messages int;
  v_notifications int;
  v_restocked int;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can clear test data.';
  end if;

  select count(*) into v_orders from public.orders;
  select count(*) into v_messages from public.messages;
  select count(*) into v_notifications from public.notifications;
  select count(*) into v_restocked from public.products where not in_stock;

  delete from public.orders where true;  -- "where true" is required by Supabase
  delete from public.messages where true;  -- "where true" is required by Supabase
  delete from public.notifications where true;  -- "where true" is required by Supabase
  update public.products set in_stock = true where not in_stock;
  perform setval('public.order_seq', 2001, false);

  return jsonb_build_object(
    'orders', v_orders,
    'messages', v_messages,
    'notifications', v_notifications,
    'restocked', v_restocked
  );
end $$;

revoke execute on function public.admin_reset_test_data() from public, anon;
grant execute on function public.admin_reset_test_data() to authenticated;

-- Let the admin delete proof-of-payment files too, so nothing is left behind.
drop policy if exists "proofs: admin can delete" on storage.objects;
create policy "proofs: admin can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'proofs' and public.is_admin());
