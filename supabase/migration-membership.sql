-- Lets the admin pause (revoke) or restore a distributor's membership.
-- A revoked distributor can still sign in and see their past orders, but
-- cannot place new ones. Nothing is deleted, so they can be restored.
-- Safe to run more than once.

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'approved', 'declined', 'revoked'));

create or replace function public.admin_set_membership(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change a distributor''s membership.';
  end if;
  if p_status not in ('approved', 'declined', 'revoked') then
    raise exception 'Unknown membership status: %', p_status;
  end if;

  select name into v_name from public.profiles where id = p_user and role = 'distributor';
  if v_name is null then
    raise exception 'That distributor was not found.';
  end if;

  update public.profiles
     set status = p_status,
         decided_at = now()
   where id = p_user and role = 'distributor';

  if p_status = 'approved' then
    perform public.notify(p_user, 'account', 'Your trade account is active',
      'You can order at distributor prices again.', '/home');
  elsif p_status = 'revoked' then
    perform public.notify(p_user, 'account', 'Your trade account is on hold',
      'You cannot place new orders for now. Chat to Royal Tiara if this is unexpected.', '/chat');
  end if;
end $$;

revoke execute on function public.admin_set_membership(uuid, text) from public, anon;
grant execute on function public.admin_set_membership(uuid, text) to authenticated;
