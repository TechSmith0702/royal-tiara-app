-- The joining fee, collected in the app.
--
-- An approved distributor whose joining fee is not yet paid sees a "Pay your
-- joining fee" screen instead of the shop. Paying by card (PayFast) unlocks
-- the account by itself. Bank-transfer applicants are approved once their
-- payment has reflected, so approving them marks the fee paid; the admin can
-- also mark it paid by hand.
--
-- Distributors who were already approved before this change are treated as
-- paid, so nobody who is already ordering gets locked out.
-- Safe to run more than once.

alter table public.profiles add column if not exists join_fee_paid_at timestamptz;
alter table public.profiles add column if not exists join_fee_amount numeric(10, 2);
alter table public.profiles add column if not exists join_fee_reference text;

update public.profiles
   set join_fee_paid_at = coalesce(decided_at, created_at, now()),
       join_fee_reference = 'before the app collected joining fees'
 where role = 'distributor' and status in ('approved', 'revoked') and join_fee_paid_at is null;


-- ---------------------------------------------------------------------
-- Approving: bank-transfer applicants (and everyone, if the fee is R0) count
-- as paid. Card applicants pay in the app straight after.
-- ---------------------------------------------------------------------
create or replace function public.admin_decide_application(p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  fee numeric := coalesce((select joining_fee from public.settings where id), 0);
  p public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can approve applications.';
  end if;

  update public.profiles
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_at = now()
   where id = p_user and role = 'distributor'
  returning * into p;

  if p_approve and p.join_fee_paid_at is null and (fee <= 0 or p.join_pay is distinct from 'card') then
    update public.profiles
       set join_fee_paid_at = now(),
           join_fee_amount = fee,
           join_fee_reference = case when fee <= 0 then 'no joining fee' else 'bank transfer, approved by admin' end
     where id = p_user;
    p.join_fee_paid_at := now();
  end if;

  if p_approve then
    if p.join_fee_paid_at is null then
      perform public.notify(p_user, 'account', 'Your trade account is approved',
        'Welcome to Royal Tiara! Pay your joining fee by card to start ordering.', '/join-fee');
    else
      perform public.notify(p_user, 'account', 'Your trade account is approved',
        'Welcome to Royal Tiara — you can now order at distributor prices.', '/home');
    end if;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- PayFast confirms a joining-fee payment (called by payfast-notify only).
-- ---------------------------------------------------------------------
create or replace function public.payfast_mark_joining_paid(p_user uuid, p_amount numeric, p_reference text)
returns text language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = p_user for update;
  if p.id is null then
    return 'unknown distributor';
  end if;
  if p.join_fee_paid_at is not null then
    return 'already paid';          -- PayFast may send the same message twice
  end if;
  -- The amount must be the joining fee itself: without a PayFast passphrase a
  -- tampered browser could otherwise pay less.
  if round(p_amount, 2) <> round(coalesce((select joining_fee from public.settings where id), 0), 2) then
    return 'amount mismatch';
  end if;

  update public.profiles
     set join_fee_paid_at = now(),
         join_fee_amount = p_amount,
         join_fee_reference = 'PayFast ' || p_reference
   where id = p_user;

  perform public.notify(p_user, 'account', 'Joining fee received',
    'Thank you! Your trade account is active - you can now order at distributor prices.', '/home');
  perform public.notify_admins('account', 'Joining fee paid',
    coalesce(nullif(p.business, ''), p.name) || ' paid the R' || to_char(p_amount, 'FM999990.00') || ' joining fee by card.',
    '/admin/person/' || p.id);

  return 'paid';
end $$;

revoke execute on function public.payfast_mark_joining_paid(uuid, numeric, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- The admin marks a joining fee paid by hand (e.g. paid by bank transfer
-- after approval).
-- ---------------------------------------------------------------------
create or replace function public.admin_mark_joining_paid(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  fee numeric := coalesce((select joining_fee from public.settings where id), 0);
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do this.';
  end if;

  update public.profiles
     set join_fee_paid_at = now(),
         join_fee_amount = fee,
         join_fee_reference = 'marked paid by admin'
   where id = p_user and role = 'distributor' and join_fee_paid_at is null;

  if found then
    perform public.notify(p_user, 'account', 'Joining fee received',
      'Thank you! Your trade account is active - you can now order at distributor prices.', '/home');
  end if;
end $$;

revoke execute on function public.admin_mark_joining_paid(uuid) from public, anon;
grant execute on function public.admin_mark_joining_paid(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- The database itself refuses orders until the joining fee is paid, whatever
-- the app shows.
-- ---------------------------------------------------------------------
create or replace function public.orders_require_joining_fee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.profiles
     where id = new.user_id and role = 'distributor' and join_fee_paid_at is null
  ) then
    raise exception 'Please pay your joining fee before ordering.';
  end if;
  return new;
end $$;

drop trigger if exists orders_require_joining_fee on public.orders;
create trigger orders_require_joining_fee
  before insert on public.orders
  for each row execute function public.orders_require_joining_fee();
