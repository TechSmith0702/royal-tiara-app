-- The delivery fee and the joining fee, editable by the admin instead of
-- being fixed in the code. One row, and everyone reads the same numbers.
-- Safe to run more than once.

create table if not exists public.settings (
  id           boolean primary key default true check (id),
  delivery_fee numeric(10, 2) not null default 90,
  joining_fee  numeric(10, 2) not null default 200,
  updated_at   timestamptz not null default now()
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

-- Anyone may read them: the joining fee is shown on the public apply form.
alter table public.settings enable row level security;
drop policy if exists "settings: anyone may read" on public.settings;
create policy "settings: anyone may read" on public.settings
  for select to anon, authenticated using (true);
revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;

create or replace function public.admin_save_fees(p_delivery numeric, p_joining numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change the fees.';
  end if;
  if p_delivery is null or p_delivery < 0 then
    raise exception 'The delivery fee cannot be less than zero.';
  end if;
  if p_joining is null or p_joining < 0 then
    raise exception 'The joining fee cannot be less than zero.';
  end if;

  update public.settings
     set delivery_fee = round(p_delivery, 2),
         joining_fee = round(p_joining, 2),
         updated_at = now()
   where id = true;
end $$;

revoke execute on function public.admin_save_fees(numeric, numeric) from public, anon;
grant execute on function public.admin_save_fees(numeric, numeric) to authenticated;

-- Orders now charge whatever the admin last saved. This is the same
-- place_order as before, with the fee read from the settings row instead of
-- being fixed at 90. Pricing still happens on the server.
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
  v_delivery numeric(10, 2);
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

  select coalesce(delivery_fee, 90) into v_delivery from public.settings where id = true;
  v_delivery := coalesce(v_delivery, 90);

  v_seq := nextval('public.order_seq');

  -- Card payments stay unverified until PayFast is connected and confirms them.
  insert into public.orders (
    id, invoice, user_id, customer, business, address_line1, address_line2, lines,
    subtotal, delivery, total, pay_method, proof, pay_status, events
  ) values (
    'RT-' || v_seq, 'INV-' || v_seq, me.id, me.name, me.business, me.address_line1, me.address_line2, v_lines,
    v_subtotal, v_delivery, v_subtotal + v_delivery, p_pay_method, v_proof, 'unverified',
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


-- Live updates: a fee change reaches every open phone at once.
do $$
begin
  begin
    alter publication supabase_realtime add table public.settings;
  exception when duplicate_object then null;
  end;
end $$;
