-- Extra details on a distributor's page in the admin console, which live with
-- their login rather than their profile: whether they confirmed their email,
-- when they last signed in, and what they ticked when they applied (the
-- distributor terms and the monthly minimum). Admins only.
-- Safe to run more than once.

create or replace function public.admin_person_details(p_user uuid)
returns table (
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  terms_version text,
  terms_accepted_at text,
  monthly_minimum_accepted text
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can see this.';
  end if;

  return query
    select u.email_confirmed_at,
           u.last_sign_in_at,
           u.raw_user_meta_data ->> 'terms_version',
           u.raw_user_meta_data ->> 'terms_accepted_at',
           u.raw_user_meta_data ->> 'monthly_minimum_accepted'
      from auth.users u
     where u.id = p_user;
end $$;

revoke execute on function public.admin_person_details(uuid) from public, anon;
grant execute on function public.admin_person_details(uuid) to authenticated;
