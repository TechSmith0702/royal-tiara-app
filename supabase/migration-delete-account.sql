-- "Delete my account": a distributor (or someone whose application is still
-- pending or was declined) can remove their own account from inside the app.
--
-- What goes: the login, the profile (name, business, phone, address), their
-- chat, their notifications and the devices they turned notifications on for.
--
-- What stays: their orders and invoices, which Royal Tiara has to keep as
-- sales and tax records. Each order already carries its own copy of the
-- customer name and delivery address, so it simply stops pointing at an
-- account. Proof-of-payment files stay with those orders (admin only).
--
-- Safe to run more than once.


-- ---------------------------------------------------------------------
-- Orders may outlive the account that placed them.
-- ---------------------------------------------------------------------
alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;


-- ---------------------------------------------------------------------
-- An order without an account has nobody to notify. Without this, verifying
-- or packing such an order (or PayFast confirming it) would fail.
-- ---------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, p_body, p_link
   where p_user is not null;
$$;

revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- The action behind the "Delete my account" button. It only ever deletes the
-- account of whoever calls it.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Sign in first.';
  end if;
  if me.role = 'admin' then
    raise exception 'An admin account cannot be deleted from the app. Ask another admin to remove it.';
  end if;

  perform public.notify_admins(
    'account',
    'Account deleted',
    coalesce(nullif(me.business, ''), nullif(me.name, ''), 'A distributor')
      || ' deleted their account. Their past orders are kept.',
    '/admin'
  );

  -- Removing the login removes the profile, chat, notifications and
  -- notification devices with it; orders are kept and detached (see above).
  delete from auth.users where id = me.id;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
