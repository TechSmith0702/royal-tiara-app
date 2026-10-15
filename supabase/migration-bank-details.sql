-- Royal Tiara's bank details, for distributors paying by bank transfer.
--
-- The admin types them in on the Sales tab. Distributors see them at checkout,
-- on the order page and on invoices; applicants see them for the joining fee.
-- Only signed-in people can read them, only an admin can change them, and
-- every change is announced to all admins (a swapped account number is the
-- usual way payments get stolen).
-- Safe to run more than once.

create table if not exists public.bank_details (
  id             boolean primary key default true check (id),   -- a single row
  holder         text not null default '',
  bank           text not null default '',
  account_number text not null default '',
  branch_code    text not null default '',
  account_type   text not null default '',
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null
);

insert into public.bank_details (id) values (true) on conflict (id) do nothing;

alter table public.bank_details enable row level security;

drop policy if exists "bank details: signed-in read" on public.bank_details;
create policy "bank details: signed-in read" on public.bank_details
  for select to authenticated using (true);

-- No insert/update/delete policies: changes go through the function below.
revoke all on public.bank_details from anon;
grant select on public.bank_details to authenticated;


create or replace function public.admin_save_bank_details(
  p_holder text, p_bank text, p_account_number text, p_branch_code text, p_account_type text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  acc text := regexp_replace(coalesce(p_account_number, ''), '\D', '', 'g');
  branch text := regexp_replace(coalesce(p_branch_code, ''), '\D', '', 'g');
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change the bank details.';
  end if;
  if trim(coalesce(p_holder, '')) = '' or trim(coalesce(p_bank, '')) = '' then
    raise exception 'Fill in the account holder and the bank.';
  end if;
  if length(acc) not between 6 and 16 then
    raise exception 'The account number should be 6 to 16 digits.';
  end if;
  if length(branch) <> 6 then
    raise exception 'The branch code should be 6 digits.';
  end if;

  select * into me from public.profiles where id = auth.uid();

  update public.bank_details
     set holder = trim(p_holder),
         bank = trim(p_bank),
         account_number = acc,
         branch_code = branch,
         account_type = trim(coalesce(p_account_type, '')),
         updated_at = now(),
         updated_by = auth.uid()
   where id;

  perform public.notify_admins('account', 'Bank details changed',
    coalesce(nullif(me.name, ''), 'An admin') || ' changed the bank details to ' || trim(p_bank)
      || ' account ending ' || right(acc, 4) || '. If this was not you or Royal Tiara, change them back straight away.',
    '/admin?tab=sales');
end $$;

revoke execute on function public.admin_save_bank_details(text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_bank_details(text, text, text, text, text) to authenticated;
