# Royal Tiara Trade Portal — Maintainer's Handbook

How the app works, how to look after it, and what to do when something goes
wrong. Written for whoever maintains it next: Thando, Royal Tiara's web
developer, or an AI assistant you paste this file into.

Last updated: 19 October 2026. **Taking over? Read section 17 (Handover) first.**

---

## 1. What the app is

A private ordering app for Royal Tiara's distributors (resellers). They apply
for a trade account, the admin approves them, and they order at distributor
prices, pay by card (PayFast) or bank transfer, and track each order until it
is delivered. The admin (Dinah, the owner) runs everything from the admin
console: applications, payments, packing, the catalogue, fees and chat.

It is one app that runs in four places:

| Version | Where | Status |
|---|---|---|
| **Website** | https://royaltiara.netlify.app | Live |
| **Installed web app** ("Install the app" / Add to Home Screen) | Android, iPhone, computers | Live; updates itself |
| **Google Play app** (TWA, `twa/` folder) | Built, signed and tested on a real phone (v1.0.0) | Not published yet (section 11) |
| **Android app** (Capacitor, `android/` folder) | Older approach, built on an emulator only; replaced by the TWA for Google Play | Not used |
| **iPhone app** (Capacitor, `ios/` folder) | Set up; not built yet (needs Apple's $99/year account) | Not published |

All four use the same code (`src/`) and the same database.

---

## 2. Who does what

**Day-to-day running needs no code.** The admin does it in the app:

- approve or decline trade applications, put a distributor on hold
- verify bank-transfer payments (card payments verify themselves)
- mark orders packed, collected and delivered, and add the courier and tracking number (Sales: type them in before tapping "Mark collected by courier", or add/change them later). The distributor sees "Your tracking number is ..." on the order
- chat with distributors
- add products, change prices and photos, mark items out of stock
- change the delivery fee and the joining fee (Admin → menu → Settings)
- change the bank details distributors pay into (Admin → menu → Settings → Bank details; every change notifies all admins)
- set the monthly minimum a distributor must order to keep their discount (Admin → menu → Settings → Monthly minimum; 0 means none). New applicants tick that they accept it
- choose and order the "Moving fast" products on the distributor home screen (Admin → Catalogue: the star on each product, and the arrows in the Moving fast list)
- see whether a distributor has paid the joining fee, and mark it paid after a bank transfer (Admin → the distributor). Card applicants pay it in the app straight after approval and are unlocked automatically; bank-transfer applicants count as paid when approved, so approve them once the fee has reflected

**A technical person is only needed to:**

- change how the app works (code), then publish it
- run a database change (a `.sql` file)
- deal with accounts, keys and renewals (section 4)
- fix something after an outside change (PayFast, Supabase, a browser update)

---

## 3. How the pieces fit together

```
 Distributor / admin phone
        |
        v
 Website (React app)  <--- built by Netlify from GitHub (branch: main)
        |
        +--> Supabase: database, logins, file storage (proof of payment,
        |    product photos), live updates (orders, chat), and two
        |    "Edge Functions":
        |       payfast-checkout - prepares and signs each card payment
        |       payfast-notify   - PayFast calls it to confirm card payments
        |       push-send        - sends lock-screen notifications
        |
        +--> PayFast: card payments (the browser goes there and comes back;
             PayFast separately tells payfast-notify the payment went through)
```

Key facts:

- **Prices and totals are worked out in the database**, never trusted from the
  phone. A tampered browser cannot order cheaper.
- **Each person only sees their own data.** This is enforced by database rules
  (Row Level Security), not just hidden in the screens.
- **Card orders are marked paid only by PayFast's confirmation**, checked four
  ways (signature, PayFast's servers, PayFast's own validation, amount).
- **Notifications:** every row in `notifications`, and every chat message,
  triggers `push-send`, which delivers it to the devices that turned
  notifications on.

---

## 4. Accounts, keys and where things live

Keep every login and key below in a password manager. **Several accounts are
currently in Thando's name; consider adding Royal Tiara (or the web developer)
as members so the business never depends on one person.**

| What | Where | Notes |
|---|---|---|
| Code | GitHub: `TechSmith0702/royal-tiara-app` (private) | Add collaborators under Settings → Collaborators |
| Website hosting | Netlify site `royaltiara` | Builds cost credits (see section 6) |
| Database, logins, files, functions | Supabase project `zfeqbhoqdcrrcxfwrctb` ("royal-tiara") | Dashboard: supabase.com |
| Card payments | PayFast, Royal Tiara's own merchant account, **live** (real money) since 15 Oct 2026 | Section 10 |
| iPhone cloud builds | Codemagic, connected to the GitHub repo | Free monthly Mac minutes |
| Royal Tiara's domain and email | Webway (cPanel), `royaltiara.co.za` | Mail server `mail.royaltiara.co.za` |
| Emails the app sends (sign-up, password reset) | Supabase → Authentication → Emails → SMTP Settings | Currently Thando's Gmail (smtp.gmail.com, a Google App Password called "Royal Tiara app"), because mail from `info@royaltiara.co.za` was accepted but never delivered (section 17) |

**Settings the website needs** (Netlify → Project configuration → Environment
variables; the same names go in a local `.env` file, see `.env.example`):

| Name | What |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Connection to Supabase. The publishable key is meant to be public |
| `VITE_PAYFAST_MODE` | `sandbox` or `live`. Only switches the "test mode" notes in the app |
| `VITE_TEST_TOOLS` | `off` on the live site |

PayFast's merchant details are **not** website settings (anything starting
`VITE_` is readable by anyone). They are Supabase secrets, below.

**Secrets kept inside Supabase** (Edge Functions → Secrets, or
`npx.cmd supabase secrets list --project-ref zfeqbhoqdcrrcxfwrctb`):

| Name | What |
|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push notification keys. The public key is also written in `src/lib/push.js` |
| `PAYFAST_MODE` | `sandbox` (default) or `live` |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY` | Royal Tiara's PayFast account. Without them, sandbox uses PayFast's public test account |
| `PAYFAST_PASSPHRASE` | The "Salt Passphrase" set in the PayFast dashboard. Signs every payment |

**Never put a secret key in the app's code or in a `VITE_` setting.** Anything
starting `VITE_` ends up in the website for anyone to read.

**Android signing key** (created 16 Oct 2026, see section 11): the file and its password must be
backed up safely. Every future Android version must be signed with it; if it
is lost, people have to uninstall and reinstall to get updates.

---

## 5. Setting up a computer to work on the app

1. Install **Node.js 22** (nodejs.org) and **Git** (git-scm.com).
2. Get the code:
   ```
   git clone https://github.com/TechSmith0702/royal-tiara-app.git C:\Projects\royal-tiara-app
   cd C:\Projects\royal-tiara-app
   npm ci
   ```
3. Copy `.env.example` to `.env` and fill in the real values (same as Netlify).
4. Start it: `npm run dev`, then open http://localhost:5190.

**Windows notes (these cost us time once):**

- In **PowerShell**, type `npm.cmd` and `npx.cmd` instead of `npm` and `npx`.
  PowerShell blocks the `.ps1` versions on this PC. Git Bash and Command Prompt
  accept plain `npm`.
- **Keep projects out of OneDrive** (use `C:\Projects`). OneDrive locks build
  files and pops up "Delete these items?" warnings when git tidies up.
- **VS Code:** the Java extensions are disabled *for this workspace only*, and
  `.vscode/settings.json` turns off Gradle importing. Without that, VS Code
  started hundreds of Gradle processes and froze the PC (section 13).
- Test accounts: sign in yourself; never share passwords in chat or commits.

---

## 6. Making a change and publishing it

1. Change the code and test it locally (`npm run dev`).
2. Save it in git:
   ```
   git add -A
   git commit -m "What changed and why"
   ```
3. Publish: `git push`, then Netlify → Deploys → **Trigger deploy** → **Deploy site**.
   Automatic builds are currently **stopped** to save credits, so a push alone
   does not change the live site. The build takes about a minute.

**Netlify credits:** every build costs credits. Batch several changes into one
push instead of pushing each fix. Pushes that only touch `android/`, `ios/`,
`capacitor.config.json`, `.env.native`, `codemagic.yaml` or the icon script
are skipped automatically (the `ignore` line in `netlify.toml`). So are `twa/`
and `*.md` files.

**Deploying by hand** (app.netlify.com → the `royaltiara` site):

- **Rebuild the latest code:** Deploys → **Trigger deploy** → **Deploy site**.
  Needed after changing an environment variable. If a build seems stuck on old
  files: **Clear cache and deploy site**.
- **Only deploy when you choose:** Project configuration → Build & deploy →
  Continuous deployment → Build settings → Configure → Build status
  **Stopped builds**.
  Pushes then wait on GitHub until you use Trigger deploy. Set back to
  **Active** for automatic builds.
- **Freeze the live version:** Deploys → **Lock to stop auto publishing**; new
  builds wait until you publish them.
- **Status:** each deploy shows Published, Building, Failed or Skipped. Open a
  failed one for its log (the red lines near the end say what went wrong).

**Undoing a bad release:** Netlify → Deploys → pick the previous good deploy →
**Publish deploy**. That restores the old site instantly (no build, no
credits). Then fix the code, or undo the commit with `git revert <commit>` and
push.

---

## 7. Database changes

Database changes live in `supabase/*.sql`. Each file says what it does at the
top and is **safe to run more than once**. To run one: Supabase dashboard →
**SQL Editor** → New query → paste the whole file → **Run**.

**Setting up a brand-new database** (only if starting over), in this order:

1. `schema.sql`
2. `seed-products.sql`
3. `migration-delivered.sql`
4. `migration-reset-button.sql`
5. `migration-product-photos.sql`
6. `migration-product-editor.sql`
7. `remove-sets.sql`
8. `migration-delete-product.sql`
9. `migration-membership.sql`
10. `migration-payfast-itn.sql`
11. `migration-fees.sql`
12. `migration-card-retry.sql`
13. `migration-push.sql`
14. `migration-delete-account.sql`
15. `migration-cancel-order.sql`
16. `migration-bank-details.sql`
17. `migration-joining-fee.sql`
18. `migration-minimum-and-featured.sql`
19. `migration-person-details.sql`
20. `migration-deliver-to-and-tracking.sql`
21. `migration-pickup-points.sql`
22. `migration-recipient-email.sql`

Then deploy both Edge Functions and set their secrets (section 8), sign up in
the app, and make that account the admin:

```sql
update public.profiles set role = 'admin', status = 'approved', name = 'Dinah Smith'
 where email = 'dinah@royaltiara.co.za';
```

The same line adds any **extra admin** (sign up in the app first, then run it
with their email).

**Checking the database from the command line** (after `npx.cmd supabase login`):

```
npx.cmd supabase db query --linked --project-ref zfeqbhoqdcrrcxfwrctb "select count(*) from public.orders"
```

---

## 8. Supabase Edge Functions

Three small server programs in `supabase/functions/`:

- **`payfast-checkout`**: prepares each card payment. It checks the order
  belongs to the person paying, takes the amount from the database, and signs
  it with the merchant details and passphrase from the secrets.
- **`payfast-notify`**: receives PayFast's payment confirmations and marks the
  order paid (calls the database function `payfast_mark_paid`).
- **`push-send`**: sends lock-screen notifications for new notifications and
  chat messages.

After changing either one:

```
npx.cmd supabase login
npx.cmd supabase functions deploy payfast-checkout --no-verify-jwt --use-api --project-ref zfeqbhoqdcrrcxfwrctb
npx.cmd supabase functions deploy payfast-notify --no-verify-jwt --use-api --project-ref zfeqbhoqdcrrcxfwrctb
npx.cmd supabase functions deploy push-send --no-verify-jwt --use-api --project-ref zfeqbhoqdcrrcxfwrctb
```

`--no-verify-jwt` is required: PayFast and the database call these functions
without signing in, and `payfast-checkout` checks the person's sign-in itself.
None of them trusts its input (see the comments at the top of each file).

**Logs:** Supabase → Edge Functions → pick the function → **Logs**. This is
the first place to look when card payments are not confirming or
notifications are not arriving.

---

## 9. Notifications

- Work on the **website and installed web app** (Android, computers, iPhone
  from the home screen on iOS 16.4+). Need `https://` or `localhost`.
- Turned on per device: bell → **gear** → Turn on notifications. Signing out
  turns them off on that device.
- The Android/iPhone **store** versions cannot use them yet; they would need
  Google Firebase and Apple's push service.
- If the VAPID keys ever have to be replaced, everyone must turn
  notifications on again.

---

## 10. Payments

**Card (PayFast):** the distributor pays on PayFast's page and returns to the
app ("Confirming your card payment..."). PayFast separately calls
`payfast-notify`, which marks the order paid, usually within seconds. If no
confirmation arrives within 30 seconds, the order page offers to pay again or
switch to bank transfer (a late confirmation still marks it paid). The joining
fee works the same way on the `/join-fee` screen (payment reference
`JOIN-<user id>`).

**Bank transfer:** the distributor uploads a proof of payment; the admin
checks the bank account and taps **Verify** in Sales.

**Live since 15 Oct 2026.** No Salt Passphrase is set in PayFast, so there is
no `PAYFAST_PASSPHRASE` secret; amounts are checked against the database
instead. **If anyone ever sets a passphrase in the PayFast dashboard, add the
`PAYFAST_PASSPHRASE` secret at the same moment, or card payments stop
working.** The steps below are how it was done, kept for reference.

**Going live with real money:**

1. Your mum's PayFast dashboard → Settings → Developer settings: optionally set a
   **Salt Passphrase**. Keep it, the merchant ID and the merchant key in a
   password manager.
2. **Push the latest code first** (the website must already be using
   `payfast-checkout`), and let Netlify finish.
3. Supabase → Edge Functions → **Secrets** → add, typing the values yourself:
   `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and
   set `PAYFAST_MODE` to `live`. Both PayFast functions use them straight away.
4. Netlify → Environment variables: `VITE_PAYFAST_MODE=live` (removes the
   "test mode" notes), then **Trigger deploy**. The old
   `VITE_PAYFAST_MERCHANT_ID`, `_MERCHANT_KEY`, `_PASSPHRASE` and
   `_NOTIFY_URL` settings are no longer used and can be deleted.
5. Test with a real card: the cheapest order is a R40 product plus delivery.
   To keep it small, set the delivery fee to R0 in Admin → menu → Settings for
   the test, then put it back. Check the order turns "Payment verified" by
   itself, then refund it from the PayFast dashboard.

**Back to test mode:** set `PAYFAST_MODE` to `sandbox` (and the Netlify
label back), then Trigger deploy.

---

## 11. Android and iPhone apps

Both are in the same project and reuse the website code.

```
npm run android:build    # copy the latest app into android/
npm run ios:build        # copy the latest app into ios/
```

`.env.native` adds the settings the phone apps need (website address, PayFast
notify URL).

**Android:** open the `android` folder in **Android Studio** (2026.2 or newer)
and press Run. Builds go to `%LOCALAPPDATA%\royal-tiara-android-build` (not
OneDrive). Gradle must use **Java 21**.

**iPhone:** cannot be built on Windows. **Codemagic** builds it on a cloud Mac
from GitHub (`codemagic.yaml`, workflow "iPhone build check"). Installing on
real iPhones needs Apple's Developer Program ($99/year), then TestFlight and
the App Store. On iPhone, PayFast returns via `public/app-return.html`
because PayFast only accepts `https://` return addresses.

**Icons and splash screens:** `python scripts/generate-app-icons.py`
(needs Pillow) after changing `public/app-icon.png` or `public/logo.png`.

### The Google Play app (TWA)

The Play Store app is a **Trusted Web Activity**: a small Android app that
opens the live website full screen. It is in the `twa` folder, made with
Google's Bubblewrap. Website changes reach it straight away; only its name,
icon, colours or splash screen need a new upload.

- Settings (name, colours, icons, version): `twa/twa-manifest.json`. After
  changing it, regenerate: in `twa`, `npx @bubblewrap/cli@1.24.1 update`.
  Keep `"enableSiteSettingsShortcut": true`: with it off, the app crashes on
  opening (the library still uses that shortcut's screen).
  After `update`, re-add `allowChromeToReadSplash()` to
  `twa/app/src/main/java/za/co/royaltiara/trade/LauncherActivity.java` (it is in
  Git history): since Chrome 152 Chrome refuses the splash image without it,
  and shows its address bar over a black screen at start-up instead.
- **Build** (Java 17): in `twa`, `set JAVA_HOME=C:\Program Files\Java\jdk-17`
  then `gradlew.bat --no-daemon assembleRelease bundleRelease`.
  (`bubblewrap build` itself fails on this PC: its old SDK installer needs
  Java 8. Gradle directly is the same build.)
- **Sign:** double-click `twa\sign-app.cmd`. It makes `RoyalTiara.apk` (to
  install on a phone) and `RoyalTiara.aab` (to upload to Play), asking for the
  signing-key password.
- **The signing key** is `C:\Users\Private\royal-tiara-keys\royal-tiara-upload.keystore`
  (alias `royaltiara`). It is never in GitHub. **Back it up** (USB stick or a
  password manager) with its password: without it the app can never be updated.
- **For each update:** raise `appVersionCode` (by 1) and `appVersionName` in
  `twa-manifest.json`, run `update`, build, sign, upload the new `.aab`.
- **Full screen depends on** `public/.well-known/assetlinks.json` on the website
  listing the key's SHA-256 fingerprint. Once Google Play signs the app ("Play
  App Signing"), add Play's fingerprint too (Play Console → Test and release →
  App integrity), then deploy. Without it the app shows a browser address bar.

**Before either store:** create a reviewer test account. The stores also ask
for two web links, which exist: the privacy policy
(`https://royaltiara.netlify.app/privacy`) and how to delete an account
(`https://royaltiara.netlify.app/delete-account`).

---

## 12. Testing tools and clearing test data

On **localhost only**, the admin console has **Testing tools** at the bottom:
type `RESET` and press **Clear all test data**. It deletes all orders, chat,
notifications and proof files, restarts order numbers at RT-2001, and puts
every product back in stock. Accounts, products, prices and fees are kept.
**It clears the live database**, so only use it before real trading.

**Deleting accounts.** Distributors and applicants delete their own account in
the app: Account → **Delete my account** (also on the waiting screen). It
removes the login, profile, chat, notifications and notification devices.
**Orders and invoices are kept** as sales records, with the customer name and
address saved on each order, but no longer linked to an account. Admin
accounts cannot be deleted from the app.

To remove someone yourself: Supabase → Authentication → Users → ⋮ → **Delete
user**. Not from the `profiles` table (that leaves the login behind). Their
orders are kept in the same way.

**Privacy policy:** the public pages `/privacy` and `/delete-account` (the
links the app stores ask for) are in `src/screens/Privacy.jsx`. The business
details at the top of that file (contact email, Information Officer, address,
effective date) must be kept correct, and the policy should be reviewed by
someone qualified before real trading.

**Distributor terms:** the public page `/terms`, in `src/screens/Terms.jsx`.
Applicants must tick that they agree before applying; the version they agreed
to and the time are stored with their login (Supabase → Authentication → Users
→ the user → raw user metadata: `terms_version`, `terms_accepted_at`). The
business choices in it (processing times, 3 days to report damage, no returns
of opened hair care, refunds within 14 working days) follow the returns and
shipping policies on royaltiara.co.za, so change both together. The invoice
says "Invoice", not "Tax invoice": Royal Tiara is not VAT-registered as far as
we know. If it registers, the invoice must say "Tax invoice" and show the VAT
number and address (`src/screens/InvoiceView.jsx`). When the wording changes, update
both `EFFECTIVE` and `TERMS_VERSION`.

---

## 13. When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Signing in takes very long (half a minute or more), everything else fine | Usually Supabase itself is slow (it runs the sign-in) | Check https://status.supabase.com (Royal Tiara's project is in the **EU, eu-west-1** region). Wait; don't reset passwords or change settings. People already signed in are not affected |
| The whole site says it cannot connect, or data won't load | Supabase free projects **pause after about a week with no activity** | Supabase dashboard → the project → **Restore** |
| Card order stuck on "Confirming..." or unpaid after paying | PayFast's confirmation was refused: usually `PAYFAST_MODE` or `PAYFAST_MERCHANT_ID` not matching the account that was paid (e.g. a sandbox payment while the secrets say live) | Check the Supabase secrets; check `payfast-notify` logs ("ignored: ..." says why); the admin can verify by hand in Sales |
| PayFast shows "403 ERROR - Request blocked" when paying from a laptop | Live PayFast refuses return addresses at `localhost`, so real card payments cannot be tested from the local copy | Test card payments on the live website. The apps go through `public/app-return.html` on the website for the same reason |
| "The card payment could not be started" | `payfast-checkout` refused or failed | Check its logs; in live mode all three merchant secrets must be set |
| Notifications not arriving | Not turned on for that device, phone in Do Not Disturb, or the device unsubscribed | Bell → gear; check `push-send` logs |
| Password-reset or sign-up emails not arriving | SMTP settings wrong or mailbox password changed | Supabase → Authentication → Emails → SMTP Settings |
| The confirmation or password-reset link opens the wrong site, or the plain home page | The address is not on Supabase's allowed list | Supabase → Authentication → URL Configuration: Site URL `https://royaltiara.netlify.app`, Redirect URLs `https://royaltiara.netlify.app/**` (plus `http://localhost:5190/**` for testing on a PC) |
| A phone was lost or stolen, or someone must be signed out everywhere | Signing out only signs out the device you're on, and changing the password does **not** sign out other devices | Supabase → SQL Editor: `delete from auth.sessions where user_id = (select id from auth.users where email = 'their@email');` Their other devices are signed out within the hour (when their sign-in next renews). Then have them change their password |
| "The database is not set up yet" | A `.sql` migration was not run | Run the missing file (section 7) |
| Netlify build failed | A code error, or out of credits | Netlify → Deploys → the failed deploy → log |
| `npx`/`npm` "running scripts is disabled" | PowerShell policy | Use `npx.cmd` / `npm.cmd` |
| PC very slow, fan loud | VS Code Java/Gradle loop | Task Manager: many "Java(TM) Platform SE binary"? Close VS Code, end them, delete `%APPDATA%\Code\User\workspaceStorage\<id>\redhat.java`, keep the Java extensions disabled for this workspace |
| Android emulator black or off-screen | Stale quick-boot snapshot, or the window remembers a missing monitor | Device Manager → ⋮ → Cold Boot; move the window back on screen |
| OneDrive "Delete these items?" with odd file names | Git tidying its history files | Safe to delete; keep projects outside OneDrive |

---

## 14. Costs and renewals

| Item | Cost | When |
|---|---|---|
| Netlify | Credits per build | Watch the balance; batch pushes |
| Supabase | Free plan (pauses when idle; limited storage) | Upgrade if the business grows |
| Domain `royaltiara.co.za` | Webway | Yearly |
| Google Play developer account | $25 | Once, if publishing to Play |
| Apple Developer Program | $99 | Every year, if on the App Store |

---

## 15. What's next (roadmap)

1. ~~"Delete my account" and a privacy policy page~~ Done (13 Oct 2026). Still
   to do: have the policy wording checked, and fill in the business address.
2. **Google Play:** the TWA is built and tested (section 11); still to do:
   the Play Console account, store listing and upload (section 17).
3. **Own address** `app.royaltiara.co.za` (Netlify domain + a DNS record at
   Webway).
4. ~~Live PayFast payments~~ Done (15 Oct 2026).
5. **iPhone App Store** (section 11).
6. **Email alerts** for the admin, as a backup to notifications.
7. **Paging in the admin console** once there are hundreds of orders.

---

## 16. Glossary

- **Netlify:** hosts the website and rebuilds it when code is pushed.
- **Supabase:** the database, logins, file storage and server functions.
- **Migration:** a `.sql` file that changes the database structure.
- **Edge Function:** a small server program running on Supabase.
- **ITN:** PayFast's "Instant Transaction Notification", the payment
  confirmation sent to `payfast-notify`.
- **Web Push / VAPID:** the browser notification system and its keys.
- **PWA / WebAPK:** a website installed as an app ("Install the app").
- **Capacitor:** wraps the website code into Android and iPhone apps.
- **TWA:** Trusted Web Activity, an Android APK that runs the website full screen.
- **Codemagic:** builds the iPhone app on a cloud Mac.
- **RLS:** Row Level Security, database rules that limit who sees which rows.

---

## 17. Handover (19 October 2026)

Written at the end of the build with Claude, for whoever carries on: Thando,
a web developer, or another AI assistant (Gemini, ChatGPT, Copilot...).
**AI assistants: read this whole file before suggesting changes, and follow
the rules below.** Ideally open the whole project folder in the assistant
(Gemini CLI, Gemini Code Assist in VS Code, or similar) so it can read the
code instead of guessing.

### Where things stand

Live at https://royaltiara.netlify.app and working end to end, with real money:

- Applications with a single "I agree" tick box (terms and the monthly
  minimum), admin approval, and the joining fee (card via PayFast, or bank
  transfer marked paid by the admin)
- Catalogue, cart, checkout, card payments (PayFast live) and bank transfers
  (bank details shown in the app, proof upload, admin verifies)
- Order tracking, cancelling unpaid orders (distributor or admin), invoices
- Chat, lock-screen notifications, "Install the app"
- Admin console: Sales (filters, search, verify/pack/deliver/cancel),
  Applications and distributors, Catalogue (prices, photos, stock, "Moving
  fast" picks), Chat, Settings (fees, monthly minimum, bank details)
- Distributor terms (`/terms`), privacy policy (`/privacy`), delete account
  (`/delete-account`)
- Settings chosen by the owner: every price (30% distributor discount),
  delivery fee R90, monthly minimum 10 products. **Do not change these;
  they are hers to set in the app.**

Checkout has a "Deliver to" choice: **Me** (the address on the account,
not changeable at checkout; it can still be changed under Account) or
**Anyone else** (their name, phone and optional email, then either **to their door** by The
Courier Guy, with street, suburb, city, province and postal code, or
**collect at a branch**: a PUDO locker or PAXI point they type in, with links
to PUDO's and PAXI's own maps). Admin Sales and the invoice show who it goes
to and who ordered it, and the tracking box fills in the courier (The Courier
Guy, PUDO or PAXI). One delivery fee for every option. The app does not book
the courier: the admin books it on the courier's website and types the
tracking number in Sales.

All 22 migrations have been run on the live database (check with section 7
if in doubt).

### Still to do

1. ~~**Bank details**~~ Done: the app shows Royal Tiara's Capitec account
   (Admin → menu → Settings → Bank details to change it).
2. **Email from info@royaltiara.co.za:** Supabase's SMTP was pointed at
   `mail.royaltiara.co.za:465` and the mail server accepted the messages, but
   they never arrived in Gmail (SPF, DKIM, DMARC and blocklist checks all
   looked fine; mail sent from webmail did arrive). Webway support has been
   asked for their mail log. Until it is fixed, Supabase sends from Thando's
   Gmail. Once fixed: Supabase → Authentication → Emails → SMTP Settings →
   back to info@ (or a noreply@ mailbox), send a test password reset, then
   delete the "Royal Tiara app" App Password from Thando's Google account.
   No redeploy is needed for this.
3. **Questions for the owner:**
   - Confirm Royal Tiara is **not VAT-registered** (the invoice says
     "Invoice", not "Tax invoice"; section 12 explains what changes if it is).
   - Is the joining fee refundable? The terms currently say no
     (`JOINING_FEE_REFUNDABLE` in `src/screens/Terms.jsx`).
   - Google Play account type (next item).
4. **Google Play.** The app in `twa/` is built and signed; `twa/RoyalTiara.aab`
   (v1.0.0) is ready to upload. Those files are not in GitHub; rebuild them
   with section 11 if they are missing.
   1. The owner creates a Play Console developer account ($25 once).
      A **personal** account must first run a **closed test with at least 12
      testers for 14 days** before the app can go public. An
      **organisation** account (needs a free D-U-N-S number for the business,
      which can take a while to get) skips that.
   2. Create the app, then upload `RoyalTiara.aab` to a testing track.
      Let Google manage the app signing key (Play App Signing).
   3. **Straight after the first upload:** Play Console → Test and release →
      App integrity → App signing → copy the **SHA-256** of the app signing
      key, add it as a second entry in `sha256_cert_fingerprints` in
      `public/.well-known/assetlinks.json` (keep the existing one), push and
      Trigger deploy. Without this, the copy installed from Play shows an
      address bar at the top.
   4. Store listing: app name, short description (80 characters), full
      description, 512×512 icon (`public/splash-logo-512.png`, or
      `public/app-icon.png` resized), 1024×500 feature graphic, at least two
      phone screenshots, category (Business or Shopping), contact email.
   5. Policy forms:
      - Privacy policy: `https://royaltiara.netlify.app/privacy`
      - Account deletion: `https://royaltiara.netlify.app/delete-account`
      - **App access:** the app needs a login, so give Google a test
        distributor account (approved, joining fee marked paid). The owner or
        Thando types its password into the Play Console, never an AI.
      - **Data safety:** collects name, email, phone, delivery address, chat
        messages, uploaded proof-of-payment files and order history, all to
        run orders; encrypted in transit; not sold; users can delete their
        account in the app. Card details are entered on PayFast, never in the
        app.
      - Target audience: adults (it is a trade app).
   6. Later Play updates: see "For each update" in section 11. Most changes
      are website changes and need **no** Play update at all.
5. **Before real trading starts** (if it hasn't): remove test orders and test
   distributor accounts (section 12). The reset deletes **all** orders, so
   never use it once real orders exist; delete single test accounts in
   Supabase instead.
6. Optional later: a one-time "accept the terms" screen for distributors who
   joined before the terms existed; the custom address `app.royaltiara.co.za`;
   an iPhone version (Apple $99/year plus Codemagic, section 11).

### Rules for anyone changing the app (people and AI assistants)

- **Never change product prices, the delivery fee, the joining fee or the
  monthly minimum** in code or the database. The owner sets them in the app.
- **Never put passwords, PayFast details or other secrets in the code, in
  GitHub, in a `VITE_` setting or in a chat with an AI.** Secrets live in
  Supabase → Edge Functions → Secrets. People type passwords themselves.
- **Never commit the signing key** (`C:\Users\Private\royal-tiara-keys`) or
  the `.apk`/`.aab` files. Keep a backup of the key and its password.
- **Test locally first** (`npm run dev`, http://localhost:5190), then batch
  several changes into **one** push and one Trigger deploy (Netlify credits).
  Card payments can only be tested on the live site (section 13).
- **Database changes:** add a new `supabase/migration-<name>.sql` file that is
  safe to run twice; never edit old migrations. Rehearse it first without
  changing anything: wrap it in a block that runs it, checks the result and
  then deliberately fails, so everything is rolled back:
  ```sql
  do $test$
  declare out text := '';
  begin
    execute $mig$ <the whole migration here> $mig$;
    -- checks, e.g. out := out || (select count(*) from public.orders)::text;
    raise exception 'RESULTS %', out;   -- this undoes everything above
  end $test$;
  ```
  Run it in the SQL Editor (or with `npx.cmd supabase db query --linked
  --project-ref zfeqbhoqdcrrcxfwrctb -f file.sql`). Only when the results are
  right, run the real file, then add it to the list in section 7.
- **Security lives in the database.** Every write goes through a `security
  definer` function that checks `auth.uid()` / `is_admin()`, and the tables
  have Row Level Security. Never "fix" a permission error by loosening RLS or
  by moving a check into the screens only.
- **Edge Functions** must be deployed with `--no-verify-jwt` (section 8).
- **Confirmations on screen** use the app's own in-page dialog
  (`src/components/ConfirmDialog.jsx`, `useConfirm()`), not `window.confirm`,
  which some browsers and app windows block.
- **Android app (TWA):** keep `enableSiteSettingsShortcut: true`, and re-add
  `allowChromeToReadSplash()` after any `bubblewrap update` (section 11). Both
  were hard-won fixes: without them the app crashes, or shows Chrome's address
  bar at start-up.
- After changing how something works, update this handbook in the same push.

### Map of the code

| Where | What |
|---|---|
| `src/App.jsx` | All routes and who may open them (distributor, admin, pending, joining fee due) |
| `src/lib/auth.jsx` | Sign in, sign up, sign out; the signed-in profile (`useAuth`) |
| `src/lib/db.js` | Every database read and RPC call; `fetchFees` (fees, minimum, discount) |
| `src/lib/live.js` | `useLive`: loads data and refreshes it when the tables change |
| `src/lib/orders.js` | Order status, steps, labels and colours, `canCancel` |
| `src/lib/payfast.js`, `src/lib/platform.js` | Starting a card payment, and where PayFast returns to |
| `src/screens/` | Distributor and public screens (Home, Product, Checkout, OrderDetail, Orders, Invoices, Apply, Pending, JoinFee, Terms, Privacy...) |
| `src/screens/admin/` | Admin console (Sales, Applications, Person, CatalogueAdmin, AdminChat, AdminConversation, Settings and its forms) |
| `src/components/` | Shared pieces (`ui.jsx`, `BankDetails.jsx`, `ConfirmDialog.jsx`, `Icons.jsx`, `AppMenu.jsx`) |
| `src/styles.css` | All styling |
| `supabase/*.sql` | Database structure and functions (section 7) |
| `supabase/functions/` | Edge Functions (section 8) |
| `public/app-return.html` | Brings PayFast back into the phone apps |
| `public/.well-known/assetlinks.json` | Lets the Play app run full screen |
| `twa/` | The Google Play app (section 11) |
