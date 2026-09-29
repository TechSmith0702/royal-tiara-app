# Putting Royal Tiara online

Everything below is done once. Follow it in order — later steps need the
address that earlier steps give you.

Where things live:

| Piece | Where it runs | What it does |
| --- | --- | --- |
| The app | Netlify | What distributors and your mum see |
| The database, accounts, photos | Supabase | Everything that is saved |
| The payment confirmation | Supabase Edge Function | PayFast tells it a card payment went through |

---

## 1. Put the code on GitHub

Netlify rebuilds the site whenever the code changes, so it needs a copy.

```bash
gh repo create royal-tiara-app --private --source . --push
```

If you would rather not use GitHub, skip this and drag the `dist` folder onto
Netlify by hand each time instead.

---

## 2. Create the Netlify site

1. netlify.com → **Add new site** → **Import an existing project** → GitHub →
   pick `royal-tiara-app`.
2. Netlify reads `netlify.toml`, so the build command (`npm run build`) and
   folder (`dist`) fill in on their own. Leave them.
3. Before the first deploy, open **Site configuration → Environment variables**
   and add these four:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://zfeqbhoqdcrrcxfwrctb.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the publishable key from your `.env` |
   | `VITE_PAYFAST_MODE` | `sandbox` |
   | `VITE_PAYFAST_MERCHANT_ID` | `10000100` |
   | `VITE_PAYFAST_MERCHANT_KEY` | `46f0cd694581a` |

   Leave `VITE_PAYFAST_PASSPHRASE` out while testing: the sandbox has no
   passphrase, and PayFast rejects a signed request when there is none.

4. Deploy. Note the address it gives you, e.g. `royal-tiara.netlify.app`.
   Everything below calls this **YOUR-SITE**.

---

## 3. Tell Supabase the new address

Until this is done, confirmation and password-reset emails still point at
`localhost` and nobody can finish signing up.

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://YOUR-SITE`
- **Redirect URLs**: add `https://YOUR-SITE/**`

Keep `http://localhost:5190/**` in the list if you still develop on the laptop.

---

## 4. The payment confirmation

A card payment is only real once PayFast confirms it server to server. That
confirmation cannot reach a laptop, which is why card orders had to be checked
by hand until now.

Run the database part first — Supabase → **SQL Editor** → paste
`supabase/migration-payfast-itn.sql` → Run.

Then deploy the function (needs the Supabase CLI: `npm i -g supabase`):

```bash
supabase login
supabase link --project-ref zfeqbhoqdcrrcxfwrctb
supabase functions deploy payfast-notify --no-verify-jwt
```

`--no-verify-jwt` matters: PayFast is not signed in to anything, so the
function has to accept an anonymous call. It does its own checking instead —
the signature, that the call came from a PayFast server, PayFast's own
confirmation of the message, and the amount against the order total.

Then set the secrets it needs:

```bash
supabase secrets set PAYFAST_MODE=sandbox PAYFAST_PASSPHRASE=
```

The function's address is:

```
https://zfeqbhoqdcrrcxfwrctb.supabase.co/functions/v1/payfast-notify
```

Add it in Netlify as `VITE_PAYFAST_NOTIFY_URL`, then **Deploys → Trigger
deploy**, because the app reads these values while it builds.

---

## 5. Test the whole thing on the live site

Use a throwaway distributor account, not your mum's.

1. Apply for a trade account → confirm the email → approve it from the admin
   console.
2. Place an order, pay by **Card**, and use PayFast's sandbox wallet.
3. Within a minute the order should show **payment verified** on its own, with
   a notification for both sides. That is the confirmation working.
4. Also test a **bank transfer** order with a proof upload.
5. Check the chat, the bell, and an invoice on a real phone.

If a card order stays unverified: Supabase → **Edge Functions → payfast-notify
→ Logs**. Every ignored message says why.

---

## 6. Before real distributors use it

- [ ] Clear the test data (admin → Testing tools, while it is still on), then
      set `VITE_TEST_TOOLS` to `off` in Netlify and redeploy. The tool is
      hidden on the live site by default.
- [ ] Delete the test accounts in Supabase → Authentication → Users.
- [ ] Make your mum an admin:
      `update public.profiles set role = 'admin', status = 'approved' where email = 'her@email';`
- [ ] Decide whether you stay a second admin for support.
- [ ] Check the prices, the R90 delivery and the joining fee with her.
- [ ] Add a line to the apply form about what her customers' details are used
      for (POPIA).

## 7. Going from test money to real money

Only when she is happy with everything:

1. PayFast dashboard → her own **merchant ID** and **merchant key**, and set a
   **passphrase**.
2. In Netlify: `VITE_PAYFAST_MODE=live`, her merchant details, and
   `VITE_PAYFAST_PASSPHRASE` set to the same passphrase.
3. `supabase secrets set PAYFAST_MODE=live PAYFAST_PASSPHRASE=her-passphrase`
4. Redeploy the site, then make one small real payment (R5) and refund it.

---

## Everyday, afterwards

- Change the code → push to GitHub → Netlify rebuilds by itself.
- Change a price, a photo or a product → your mum does it in the app, and it
  is live at once. No deploy needed.
