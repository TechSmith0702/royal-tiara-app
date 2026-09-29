-- =====================================================================
-- Royal Tiara - product photos managed from the admin console
--
-- Run once: Supabase dashboard -> SQL Editor -> New query -> paste ->
-- Run. Safe to run again.
--
-- Adds a photo gallery per product. The first photo is the main one
-- shown in the catalogue; the rest appear on the product page.
-- =====================================================================

alter table public.products add column if not exists images text[] not null default '{}';

-- Products that already have a photo start with it as their only one.
update public.products
   set images = array[image]
 where image <> '' and images = '{}';

create or replace function public.admin_set_product_images(p_id text, p_images text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_images text[] := coalesce(p_images, '{}');
begin
  if not public.is_admin() then
    raise exception 'Only the admin can change product photos.';
  end if;
  if coalesce(array_length(v_images, 1), 0) > 8 then
    raise exception 'Up to 8 photos per product.';
  end if;

  update public.products
     set images = v_images,
         image = coalesce(v_images[1], '')   -- first photo is the main one
   where id = p_id;

  if not found then
    raise exception 'Product % was not found.', p_id;
  end if;
end $$;

revoke execute on function public.admin_set_product_images(text, text[]) from public, anon;
grant execute on function public.admin_set_product_images(text, text[]) to authenticated;

-- Public bucket: product photos are meant to be seen by everyone signed in,
-- but only the admin can add or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "product photos: anyone can view" on storage.objects;
create policy "product photos: anyone can view" on storage.objects
  for select using (bucket_id = 'product-photos');

drop policy if exists "product photos: admin can upload" on storage.objects;
create policy "product photos: admin can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-photos' and public.is_admin());

drop policy if exists "product photos: admin can delete" on storage.objects;
create policy "product photos: admin can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-photos' and public.is_admin());
