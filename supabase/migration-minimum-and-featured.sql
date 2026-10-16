-- Two admin settings:
--
-- 1. The monthly minimum a distributor must order to keep their distributor
--    discount. The admin chooses whether it is a rand value or a number of
--    products, the amount and the discount. Applicants tick that they accept
--    it. An amount of 0 means there is no minimum (no tick box).
--
-- 2. Which products appear under "Moving fast" on the distributor home
--    screen, and in what order. The four that were built into the app are
--    carried over.
-- Safe to run more than once.


-- ---------------------------------------------------------------------
-- 1. Monthly minimum (read by anyone, like the fees: the apply form shows it)
-- ---------------------------------------------------------------------
alter table public.settings add column if not exists monthly_min_amount numeric(10, 2) not null default 0;
alter table public.settings add column if not exists monthly_min_unit text not null default 'rand';
alter table public.settings add column if not exists distributor_discount integer not null default 30;

alter table public.settings drop constraint if exists settings_monthly_min_unit_check;
alter table public.settings add constraint settings_monthly_min_unit_check
  check (monthly_min_unit in ('rand', 'products'));

create or replace function public.admin_save_monthly_minimum(p_amount numeric, p_unit text, p_discount integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change this.';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'The minimum cannot be less than zero.';
  end if;
  if p_unit not in ('rand', 'products') then
    raise exception 'Choose a rand value or a number of products.';
  end if;
  if p_unit = 'products' and p_amount <> trunc(p_amount) then
    raise exception 'Use a whole number of products.';
  end if;
  if p_discount is null or p_discount < 0 or p_discount > 100 then
    raise exception 'The discount must be between 0 and 100 percent.';
  end if;

  update public.settings
     set monthly_min_amount = p_amount,
         monthly_min_unit = p_unit,
         distributor_discount = p_discount,
         updated_at = now()
   where id;
end $$;

revoke execute on function public.admin_save_monthly_minimum(numeric, text, integer) from public, anon;
grant execute on function public.admin_save_monthly_minimum(numeric, text, integer) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Moving fast: featured_rank is the position (1, 2, 3...), null = not shown
-- ---------------------------------------------------------------------
alter table public.products add column if not exists featured_rank integer;

-- Carry over the four the app used to show, in the same order, once.
update public.products p
   set featured_rank = f.rank
  from (values ('bhf', 1), ('beo', 2), ('hgo', 3), ('bo', 4)) as f(id, rank)
 where p.id = f.id
   and not exists (select 1 from public.products where featured_rank is not null);

create or replace function public.admin_set_featured(p_id text, p_featured boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can edit the catalogue.';
  end if;

  if p_featured then
    -- Added at the end of the list, unless it is already on it.
    update public.products
       set featured_rank = coalesce((select max(featured_rank) from public.products), 0) + 1
     where id = p_id and featured_rank is null;
  else
    update public.products set featured_rank = null where id = p_id;
    -- Close the gap so the order stays 1, 2, 3...
    update public.products p
       set featured_rank = r.n
      from (select id, row_number() over (order by featured_rank) as n
              from public.products where featured_rank is not null) r
     where p.id = r.id;
  end if;
end $$;

revoke execute on function public.admin_set_featured(text, boolean) from public, anon;
grant execute on function public.admin_set_featured(text, boolean) to authenticated;

-- Moves a Moving fast product one place earlier (p_up) or later.
create or replace function public.admin_move_featured(p_id text, p_up boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  mine integer;
  other_id text;
  other_rank integer;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can edit the catalogue.';
  end if;

  select featured_rank into mine from public.products where id = p_id;
  if mine is null then return; end if;

  select id, featured_rank into other_id, other_rank
    from public.products
   where featured_rank is not null
     and (case when p_up then featured_rank < mine else featured_rank > mine end)
   order by case when p_up then -featured_rank else featured_rank end
   limit 1;
  if other_id is null then return; end if;   -- already first or last

  update public.products set featured_rank = other_rank where id = p_id;
  update public.products set featured_rank = mine where id = other_id;
end $$;

revoke execute on function public.admin_move_featured(text, boolean) from public, anon;
grant execute on function public.admin_move_featured(text, boolean) to authenticated;
