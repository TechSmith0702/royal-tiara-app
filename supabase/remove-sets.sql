-- Royal Tiara only sells single products in the app.
-- This removes every set (the "Sets" category plus Tiara Nourishing Set).
-- Past orders are not affected: each order keeps its own copy of the
-- item names and prices.

delete from public.products
where cat = 'Sets'
   or id = 'tiara-nourishing-set';

-- Check: should list nothing.
select id, name, cat from public.products
where cat = 'Sets' or name ilike '%set%';
