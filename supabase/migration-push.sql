-- Push notifications: a phone (or browser) that turned notifications on gets
-- every new notification, and every chat message meant for its owner, on the
-- lock screen. The sending is done by the push-send Edge Function.
-- Safe to run more than once.

-- pg_net lets the database call the Edge Function without waiting for it.
create extension if not exists pg_net with schema extensions;


-- ---------------------------------------------------------------------
-- The phones/browsers that turned notifications on. One row per device.
-- Nobody reads or writes this table directly: the two actions below do it.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Turning notifications on. A shared phone moves to whoever turned them on last.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'That notification subscription is not valid.';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), left(p_endpoint, 1000), left(p_p256dh, 200), left(p_auth, 100));
end $$;

-- Turning them off, or signing out on this device.
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;


-- ---------------------------------------------------------------------
-- Each notification and chat message is pushed once. The Edge Function sets
-- pushed_at when it sends, so a repeated request does nothing. Rows that
-- existed before this migration are marked as already pushed.
-- ---------------------------------------------------------------------
alter table public.notifications add column if not exists pushed_at timestamptz;
alter table public.messages add column if not exists pushed_at timestamptz;
update public.notifications set pushed_at = coalesce(pushed_at, created_at) where pushed_at is null;
update public.messages set pushed_at = coalesce(pushed_at, created_at) where pushed_at is null;

create or replace function public.request_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform net.http_post(
      url := 'https://zfeqbhoqdcrrcxfwrctb.supabase.co/functions/v1/push-send',
      body := jsonb_build_object('kind', tg_argv[0], 'id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    -- Never let a notification problem stop an order, a payment or a message.
    raise warning 'push request failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists push_new_notification on public.notifications;
create trigger push_new_notification
  after insert on public.notifications
  for each row execute function public.request_push('notification');

drop trigger if exists push_new_message on public.messages;
create trigger push_new_message
  after insert on public.messages
  for each row execute function public.request_push('message');
