-- =====================================================================
-- Royal Tiara - add and edit products from the admin console
--
-- Run once: Supabase dashboard -> SQL Editor -> New query -> paste ->
-- Run. Safe to run again.
-- =====================================================================

-- Retired products are hidden from distributors but keep their order history.
alter table public.products add column if not exists archived boolean not null default false;

create or replace function public.admin_save_product(
  p_id       text,          -- null or '' to create a new product
  p_name     text,
  p_sub      text,
  p_cat      text,
  p_price    numeric,
  p_blurb    text,
  p_sku      text default '',
  p_variants jsonb default null,
  p_archived boolean default false
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_id      text;
  v_base    text;
  v_n       int := 1;
  v_item    jsonb;
  v_price   numeric;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can add or edit products.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Give the product a name.';
  end if;
  if coalesce(btrim(p_cat), '') = '' then
    raise exception 'Choose a category.';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'The price must be more than zero.';
  end if;

  -- Sizes with their own prices, if any.
  if p_variants is not null then
    if jsonb_typeof(p_variants) <> 'array' then
      raise exception 'Sizes are not in the expected form.';
    end if;
    if jsonb_array_length(p_variants) > 6 then
      raise exception 'Up to 6 sizes per product.';
    end if;
    for v_item in select value from jsonb_array_elements(p_variants) loop
      if coalesce(btrim(v_item->>'label'), '') = '' then
        raise exception 'Every size needs a name, like "50ml".';
      end if;
      begin
        v_price := (v_item->>'price')::numeric;
      exception when others then
        raise exception 'The price for size "%" is not a number.', v_item->>'label';
      end;
      if v_price is null or v_price <= 0 then
        raise exception 'The price for size "%" must be more than zero.', v_item->>'label';
      end if;
    end loop;
  end if;

  if coalesce(btrim(p_id), '') = '' then
    -- Build a short id from the name, e.g. "Batana Growth Spray" -> batana-growth-spray
    v_base := btrim(lower(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g')), '-');
    v_base := left(nullif(v_base, ''), 40);
    if v_base is null then v_base := 'product'; end if;
    v_id := v_base;
    while exists (select 1 from public.products where id = v_id) loop
      v_n := v_n + 1;
      v_id := v_base || '-' || v_n;
    end loop;

    insert into public.products (id, name, sub, cat, price, variants, sku, blurb, image, images, in_stock, archived, sort)
    values (
      v_id, btrim(p_name), coalesce(btrim(p_sub), ''), btrim(p_cat), p_price,
      case when p_variants is null or jsonb_array_length(p_variants) = 0 then null else p_variants end,
      coalesce(btrim(p_sku), ''), coalesce(p_blurb, ''), '', '{}', true, coalesce(p_archived, false),
      coalesce((select max(sort) from public.products), 0) + 1
    );
  else
    v_id := btrim(p_id);
    update public.products
       set name = btrim(p_name),
           sub = coalesce(btrim(p_sub), ''),
           cat = btrim(p_cat),
           price = p_price,
           variants = case when p_variants is null or jsonb_array_length(p_variants) = 0 then null else p_variants end,
           sku = coalesce(btrim(p_sku), ''),
           blurb = coalesce(p_blurb, ''),
           archived = coalesce(p_archived, false)
     where id = v_id;
    if not found then
      raise exception 'Product % was not found.', v_id;
    end if;
  end if;

  return v_id;
end $$;

revoke execute on function public.admin_save_product(text, text, text, text, numeric, text, text, jsonb, boolean) from public, anon;
grant execute on function public.admin_save_product(text, text, text, text, numeric, text, text, jsonb, boolean) to authenticated;
