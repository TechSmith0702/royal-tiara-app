-- =====================================================================
-- Royal Tiara - clear test data and start fresh
--
-- Run in: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Read each part first: deleted data cannot be brought back.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PART 1 - orders, invoices, chat and notifications
-- Keeps every account and your catalogue. Order numbers start at
-- RT-2001 again.
-- ---------------------------------------------------------------------
delete from public.orders where true;  -- "where true" is required by Supabase
delete from public.messages where true;  -- "where true" is required by Supabase
delete from public.notifications where true;  -- "where true" is required by Supabase
alter sequence public.order_seq restart with 2001;


-- ---------------------------------------------------------------------
-- PART 2 - put the catalogue back to normal
-- Marks everything in stock again. (Prices you changed stay as they are;
-- to restore the original prices, re-run seed-products.sql after
-- uncommenting its price line, or just retype the price in the app.)
-- ---------------------------------------------------------------------
update public.products set in_stock = true where in_stock = false;


-- ---------------------------------------------------------------------
-- PART 3 - delete the test accounts  (OPTIONAL)
--
-- Deletes every account EXCEPT the email(s) listed below, so keep your
-- own admin address in the list. Run PART 1 first, or this will fail
-- because those accounts still have orders.
--
-- Remove the "--" from the two lines below to use it.
-- ---------------------------------------------------------------------
-- delete from auth.users
--  where email not in ('thandomasw@gmail.com');


-- ---------------------------------------------------------------------
-- Check what is left
-- ---------------------------------------------------------------------
select
  (select count(*) from public.orders)        as orders,
  (select count(*) from public.messages)      as messages,
  (select count(*) from public.notifications) as notifications,
  (select count(*) from public.profiles)      as accounts,
  (select count(*) from public.products where not in_stock) as out_of_stock;
