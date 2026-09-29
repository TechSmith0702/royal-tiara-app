-- Lets the admin delete a product for good (the "Delete product" button).
-- Past orders are not affected: each order keeps its own copy of the item
-- names and prices. Returns the product's photo links so the app can remove
-- the photo files from storage too.
-- Safe to run more than once.

create or replace function public.admin_delete_product(p_id text)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_images text[];
begin
  if not public.is_admin() then
    raise exception 'Only the admin can delete products.';
  end if;

  delete from public.products
   where id = p_id
  returning images into v_images;

  if not found then
    raise exception 'Product % was not found.', p_id;
  end if;

  return coalesce(v_images, '{}');
end $$;

revoke execute on function public.admin_delete_product(text) from public, anon;
grant execute on function public.admin_delete_product(text) to authenticated;
