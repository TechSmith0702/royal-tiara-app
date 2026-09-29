-- =====================================================================
-- Royal Tiara trade portal — database setup
--
-- How to run: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Then do the same with supabase/seed-products.sql.
-- Safe to run again: it only creates what is missing.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Accounts: every person who signs up gets a profile.
-- Distributors start as 'pending' (a trade application) until the admin
-- approves them. Make Dinah the admin after she signs up (see bottom).
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          text not null default 'distributor' check (role in ('distributor', 'admin')),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  name          text not null default '',
  business      text not null default '',
  phone         text not null default '',
  email         text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  join_pay      text not null default 'eft' check (join_pay in ('card', 'eft')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;


-- ---------------------------------------------------------------------
-- Notifications (the bell). Only the database creates them, from the
-- actions below, so nobody can fake one.
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  link       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
$$;

create or replace function public.notify_admins(p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select id, p_kind, p_title, p_body, p_link from public.profiles where role = 'admin';
$$;

revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon, authenticated;

alter table public.notifications enable row level security;
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;


-- ---------------------------------------------------------------------
-- Sign-up: create the profile from the details entered on the
-- "Apply for a trade account" form, and tell the admin.
-- Role and status are never taken from the form.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, name, business, phone, address_line1, address_line2, join_pay)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(m->>'name', ''), 120),
    left(coalesce(nullif(m->>'business', ''), m->>'name', ''), 120),
    left(coalesce(m->>'phone', ''), 40),
    left(coalesce(m->>'address', ''), 200),
    left(coalesce(m->>'town', ''), 200),
    case when m->>'join_pay' = 'card' then 'card' else 'eft' end
  );

  perform public.notify_admins(
    'application',
    'New trade application',
    coalesce(nullif(m->>'name', ''), new.email, 'Someone') || coalesce(' · ' || nullif(m->>'town', ''), ''),
    '/admin'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- People can edit their own contact details, but never their role or status.
grant update (name, business, phone, address_line1, address_line2) on public.profiles to authenticated;

create or replace function public.admin_decide_application(p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can approve applications.';
  end if;

  update public.profiles
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_at = now()
   where id = p_user and role = 'distributor';

  if p_approve then
    perform public.notify(p_user, 'account', 'Your trade account is approved',
      'Welcome to Royal Tiara — you can now order at distributor prices.', '/home');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Products: prices and stock live here so every phone sees the same
-- catalogue. Only the admin can change them.
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id       text primary key,
  name     text not null,
  sub      text not null default '',
  cat      text not null,
  price    numeric(10, 2) not null check (price > 0),
  variants jsonb,              -- e.g. [{"label": "50ml", "price": 149}, {"label": "100ml", "price": 250}]
  sku      text not null default '',
  blurb    text not null default '',
  image    text not null default '',
  in_stock boolean not null default true,
  sort     int not null default 0
);

alter table public.products enable row level security;
drop policy if exists "products: readable when signed in" on public.products;
create policy "products: readable when signed in" on public.products
  for select to authenticated using (true);
revoke all on public.products from anon, authenticated;
grant select on public.products to authenticated;

create or replace function public.admin_update_product(p_id text, p_price numeric default null, p_in_stock boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can edit the catalogue.';
  end if;
  if p_price is not null and p_price <= 0 then
    raise exception 'Price must be more than zero.';
  end if;
  update public.products
     set price = coalesce(p_price, price),
         in_stock = coalesce(p_in_stock, in_stock)
   where id = p_id;
end $$;


-- ---------------------------------------------------------------------
-- Orders. Prices and totals are worked out here from the products table,
-- never trusted from the phone.
-- ---------------------------------------------------------------------
create sequence if not exists public.order_seq start with 2001;

create table if not exists public.orders (
  id            text primary key,                  -- RT-2001
  invoice       text not null unique,              -- INV-2001
  user_id       uuid not null references public.profiles (id),
  customer      text not null,
  business      text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  lines         jsonb not null,                    -- [{productId, variant, name, size, qty, price, total}]
  subtotal      numeric(10, 2) not null,
  delivery      numeric(10, 2) not null,
  total         numeric(10, 2) not null,
  pay_method    text not null check (pay_method in ('eft', 'card')),
  proof         jsonb,                             -- {name, type, size, path, uploadedAt}
  pay_status    text not null default 'unverified' check (pay_status in ('unverified', 'verified')),
  fulfil        text check (fulfil in ('packed', 'collected')),
  events        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;
drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or admin" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;

create or replace function public.valid_proof(p_proof jsonb)
returns boolean language sql stable as $$
  select p_proof is null
      or (jsonb_typeof(p_proof) = 'object' and (p_proof->>'path') like auth.uid()::text || '/%');
$$;

create or replace function public.place_order(p_items jsonb, p_pay_method text, p_proof jsonb default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  me         public.profiles;
  item       jsonb;
  prod       public.products;
  v_variant  int;
  v_qty      int;
  v_price    numeric(10, 2);
  v_size     text;
  v_lines    jsonb := '[]'::jsonb;
  v_subtotal numeric(10, 2) := 0;
  v_seq      bigint;
  v_now      timestamptz := now();
  v_proof    jsonb := case when p_pay_method = 'eft' then p_proof end;
  v_order    public.orders;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.role <> 'distributor' or me.status <> 'approved' then
    raise exception 'Your trade account is not active yet.';
  end if;
  if p_pay_method is null or p_pay_method not in ('eft', 'card') then
    raise exception 'Choose a payment method.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if not public.valid_proof(v_proof) then
    raise exception 'That proof of payment file is not valid.';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    select * into prod from public.products where id = item->>'productId';
    if prod.id is null then
      raise exception 'A product in your cart is no longer available.';
    end if;
    if not prod.in_stock then
      raise exception '% is out of stock. Remove it to check out.', prod.name;
    end if;

    v_qty := (item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'Check the quantity for %.', prod.name;
    end if;

    if prod.variants is not null then
      v_variant := coalesce((item->>'variant')::int, 0);
      if v_variant < 0 or v_variant >= jsonb_array_length(prod.variants) then
        raise exception 'Choose a size for %.', prod.name;
      end if;
      v_price := (prod.variants->v_variant->>'price')::numeric;
      v_size  := prod.variants->v_variant->>'label';
    else
      v_variant := null;
      v_price   := prod.price;
      v_size    := prod.sub;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'productId', prod.id, 'variant', v_variant, 'name', prod.name, 'size', v_size,
      'qty', v_qty, 'price', v_price, 'total', v_price * v_qty
    ));
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  v_seq := nextval('public.order_seq');

  -- Card payments stay unverified until PayFast is connected and confirms them.
  insert into public.orders (
    id, invoice, user_id, customer, business, address_line1, address_line2, lines,
    subtotal, delivery, total, pay_method, proof, pay_status, events
  ) values (
    'RT-' || v_seq, 'INV-' || v_seq, me.id, me.name, me.business, me.address_line1, me.address_line2, v_lines,
    v_subtotal, 90, v_subtotal + 90, p_pay_method, v_proof, 'unverified',
    jsonb_build_object('placed', v_now, 'proof', case when p_pay_method = 'card' or v_proof is not null then v_now end)
  )
  returning * into v_order;

  perform public.notify_admins(
    'order',
    'New order ' || v_order.id,
    coalesce(nullif(me.business, ''), me.name) || ' · R' || to_char(v_order.total, 'FM999999990.00')
      || case when p_pay_method = 'card' then ' · card' when v_proof is not null then ' · proof attached' else ' · awaiting proof' end,
    '/admin?tab=sales'
  );

  return v_order;
end $$;

create or replace function public.attach_proof(p_order_id text, p_proof jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_proof is null or not public.valid_proof(p_proof) then
    raise exception 'That proof of payment file is not valid.';
  end if;

  update public.orders
     set proof = p_proof,
         events = events || jsonb_build_object('proof', now())
   where id = p_order_id and user_id = auth.uid() and pay_method = 'eft' and pay_status = 'unverified';

  if not found then
    raise exception 'This order can no longer take a proof of payment.';
  end if;

  perform public.notify_admins('proof', 'Proof of payment · ' || p_order_id,
    'Check the bank account and verify the payment.', '/admin?tab=sales');
end $$;

create or replace function public.admin_advance_order(p_order_id text, p_step text)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can update orders.';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Order % was not found.', p_order_id;
  end if;

  if p_step = 'verify' then
    if o.pay_status = 'verified' then return; end if;
    update public.orders
       set pay_status = 'verified', events = events || jsonb_build_object('verified', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'Payment verified · ' || o.id,
      'Thank you! We are packing your order.', '/orders/' || o.id);

  elsif p_step = 'packed' then
    if o.pay_status <> 'verified' then raise exception 'Verify the payment first.'; end if;
    if o.fulfil is not null then return; end if;
    update public.orders
       set fulfil = 'packed', events = events || jsonb_build_object('packed', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'Packed & ready · ' || o.id,
      'Your order is packed and waiting for the courier.', '/orders/' || o.id);

  elsif p_step = 'collected' then
    if o.fulfil is distinct from 'packed' then raise exception 'Mark the order packed first.'; end if;
    update public.orders
       set fulfil = 'collected', events = events || jsonb_build_object('collected', now())
     where id = o.id;
    perform public.notify(o.user_id, 'order', 'On its way · ' || o.id,
      'The courier has collected your order.', '/orders/' || o.id);

  else
    raise exception 'Unknown order step: %', p_step;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Live chat: one conversation per distributor with Royal Tiara.
-- The distributor sees their own conversation; the admin sees all.
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id             bigint generated always as identity primary key,
  distributor_id uuid not null references public.profiles (id) on delete cascade,
  sender_id      uuid not null references public.profiles (id) on delete cascade,
  body           text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);
create index if not exists messages_thread_idx on public.messages (distributor_id, created_at);

alter table public.messages enable row level security;
drop policy if exists "messages: read own thread or admin" on public.messages;
create policy "messages: read own thread or admin" on public.messages
  for select to authenticated using (distributor_id = auth.uid() or public.is_admin());
drop policy if exists "messages: send in own thread or admin" on public.messages;
create policy "messages: send in own thread or admin" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and (distributor_id = auth.uid() or public.is_admin()));
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (distributor_id, sender_id, body) on public.messages to authenticated;

create or replace function public.mark_thread_read(p_distributor uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages
     set read_at = now()
   where distributor_id = p_distributor
     and read_at is null
     and sender_id <> auth.uid()
     and (p_distributor = auth.uid() or public.is_admin());
$$;


-- ---------------------------------------------------------------------
-- Who may call the actions above: signed-in users only (each action
-- checks for itself whether the caller is allowed).
-- ---------------------------------------------------------------------
revoke execute on function public.place_order(jsonb, text, jsonb) from public, anon;
revoke execute on function public.attach_proof(text, jsonb) from public, anon;
revoke execute on function public.admin_advance_order(text, text) from public, anon;
revoke execute on function public.admin_update_product(text, numeric, boolean) from public, anon;
revoke execute on function public.admin_decide_application(uuid, boolean) from public, anon;
revoke execute on function public.mark_thread_read(uuid) from public, anon;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.place_order(jsonb, text, jsonb) to authenticated;
grant execute on function public.attach_proof(text, jsonb) to authenticated;
grant execute on function public.admin_advance_order(text, text) to authenticated;
grant execute on function public.admin_update_product(text, numeric, boolean) to authenticated;
grant execute on function public.admin_decide_application(uuid, boolean) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;


-- ---------------------------------------------------------------------
-- Proof-of-payment files: a private bucket. Distributors upload into a
-- folder named after their account; only they and the admin can open them.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "proofs: upload to own folder" on storage.objects;
create policy "proofs: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "proofs: open own or admin" on storage.objects;
create policy "proofs: open own or admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


-- ---------------------------------------------------------------------
-- Live updates: phones get changes to these tables instantly.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['messages', 'notifications', 'orders', 'products', 'profiles'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- After Dinah has signed up in the app, run this once (with her email)
-- to make her the admin:
--
--   update public.profiles set role = 'admin', status = 'approved'
--    where email = 'dinah@example.com';
-- ---------------------------------------------------------------------
