# Royal Tiara — Trade Portal

A mobile web app where approved distributors order Royal Tiara products, and the admin (Dinah) approves trade applications, verifies payments, moves orders through fulfilment and manages prices and stock.

Built with React and Vite from the Claude Design handoff (`design_handoff_royal_tiara_b2b`).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5190. Because the dev server listens on your network, you can also open `http://<your-PC's-IP>:5190` on a phone connected to the same Wi-Fi.

## Supabase setup

The app now runs on Supabase: real logins, shared orders, live chat and notifications. Your project URL and publishable key go in `.env` (see `.env.example`).

Run these once, in the Supabase dashboard under **SQL Editor -> New query**:

1. Paste all of `supabase/schema.sql` and click **Run**. (It warns about a "destructive operation" because it drops old security rules before recreating them - that is safe.)
2. Paste all of `supabase/seed-products.sql` and click **Run**. This loads the 39 products.
3. Sign up in the app as the admin (Dinah), then run this once with her email:
   ```sql
   update public.profiles set role = 'admin', status = 'approved' where email = 'her-email@example.com';
   ```

Optional: under **Authentication -> Sign In / Providers -> Email**, turn **Confirm email** off while testing, so new accounts work immediately.

If you change products in `src/data/products.js`, run `node scripts/generate-product-seed.mjs` and re-run `seed-products.sql`. Re-running keeps the admin's prices and stock.

### How it works

- **Applying** creates a real account with an email and password. It starts as `pending` and the applicant sees a "under review" screen until the admin approves them.
- **The admin** approves or declines applications, verifies payments, moves orders through packed and collected, and edits prices and stock.
- **Notifications** are created by the database itself, so they cannot be faked: new application, new order, proof uploaded, approval, and each fulfilment step.
- **Live chat** is one conversation per distributor with Royal Tiara. Unread counts show on the Chat tab.
- **Everything is live**: an admin action appears on the distributor's phone within a second, with no refresh.

What the database enforces:
- Distributors see only their own orders, invoices, chat and notifications. The admin sees everything.
- Order prices and totals are calculated in the database, not trusted from the phone.
- Only the admin can approve applications, verify payments, advance orders, and change prices or stock.
- Proof-of-payment files are private to the distributor who uploaded them and the admin.
- Card orders stay unverified until PayFast is connected.

### Still to do

- **PayFast** for card payments (redirect at checkout, confirm with PayFast's ITN callback).
- **Push notifications** and the Android/iOS builds via Capacitor.

## Project layout

```
src/
  data/products.js      39 products (seed catalogue) + image map (files in public/products)
  lib/auth.jsx          who is signed in (Supabase email + password login)
  lib/db.js             all database reads and actions
  lib/live.js           keeps a screen in step with the database
  lib/cart.js           the cart, kept on the device until checkout
  lib/files.js          proof-of-payment uploads to private storage
  lib/orders.js         order status + tracking timeline (shared by distributor & admin)
  lib/format.js         R1 234,56 currency, dates, WhatsApp links
  components/           TabBar, AddressCard, shared UI bits
  screens/              distributor screens (incl. Chat, Notifications, Pending)
  screens/admin/        admin console (Applications, Sales, Catalogue, Chat)
  styles.css            design tokens + all styling
  supabase/             database setup + product seed (run once in Supabase)
```

## Before going live

1. **PayFast.** Create a merchant account, redirect to PayFast at checkout, and confirm payments with PayFast's ITN callback on the server (never in the browser).
2. **Hosting.** Run `npm run build` and deploy the `dist/` folder to Netlify or Vercel. SPA rewrites are already set up in `public/_redirects` and `vercel.json`. Add the two `VITE_SUPABASE_*` values as environment variables there too.
3. **Android / iOS.** Wrap this app with Capacitor, then publish to Google Play and the App Store.
