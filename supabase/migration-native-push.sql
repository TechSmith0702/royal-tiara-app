-- Push notifications for the App Store (iPhone) app. Its web view has no Web
-- Push, so the phone gives the app a token from Apple's push service (APNs)
-- instead, and push-send sends to that as well as to push_subscriptions.
-- Run after migration-push.sql. Safe to run more than once.

-- One row per phone. Nobody reads or writes this table directly: the two
-- actions below do it.
create table if not exists public.native_push_tokens (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique,
  platform   text not null default 'ios' check (platform in ('ios')),
  created_at timestamptz not null default now()
);
create index if not exists native_push_tokens_user_idx on public.native_push_tokens (user_id);

alter table public.native_push_tokens enable row level security;
revoke all on public.native_push_tokens from anon, authenticated;

-- Turning notifications on. A shared phone moves to whoever turned them on last.
create or replace function public.save_native_push_token(p_token text, p_platform text default 'ios')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  -- APNs tokens are hexadecimal (64 characters today; Apple may make them longer).
  if coalesce(p_token, '') !~ '^[0-9a-fA-F]{32,200}$' or coalesce(p_platform, '') <> 'ios' then
    raise exception 'That notification token is not valid.';
  end if;
  delete from public.native_push_tokens where token = lower(p_token);
  insert into public.native_push_tokens (user_id, token, platform)
  values (auth.uid(), lower(p_token), p_platform);
end $$;

-- Turning them off, or signing out on this phone.
create or replace function public.remove_native_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.native_push_tokens where token = lower(p_token) and user_id = auth.uid();
$$;

revoke execute on function public.save_native_push_token(text, text) from public, anon;
revoke execute on function public.remove_native_push_token(text) from public, anon;
grant execute on function public.save_native_push_token(text, text) to authenticated;
grant execute on function public.remove_native_push_token(text) to authenticated;
