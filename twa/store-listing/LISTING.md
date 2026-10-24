# Google Play store listing — Royal Tiara Trade

Everything to paste into Play Console for the first release. Images are in
this folder (`icon-512.png`, `feature-graphic-1024x500.png`,
`screenshots/`). Character limits are Google's; every text below fits.

---

## Main store listing (Grow users → Store presence → Main store listing)

**App name** (max 30)

```
Royal Tiara Trade
```

**Short description** (max 80)

```
Order Royal Tiara hair care at trade prices, pay securely and track deliveries.
```

**Full description** (max 4000)

```
Royal Tiara Trade is the ordering app for Royal Tiara's approved distributors and resellers. Order our hair-care range at distributor prices, pay securely, and follow every order until it reaches your door.

HOW IT WORKS
1. Sign up as a distributor in the app. It only takes a few minutes.
2. Royal Tiara reviews applications within one working day.
3. Pay the once-off joining fee by card or bank transfer. There are no monthly fees.
4. Start ordering at distributor prices.

ORDER IN A FEW TAPS
• The full Royal Tiara range with photos, sizes and your trade prices
• See what is moving fast and what is out of stock
• Your cart is saved, and totals with delivery are worked out for you

PAY YOUR WAY
• Card payments through PayFast, South Africa's trusted payment gateway. Your card details are entered on PayFast, never in the app
• Bank transfer, with Royal Tiara's bank details in the app and proof of payment uploaded straight from your phone

TRACK EVERY ORDER
• Clear steps from payment to packing, collection by the courier and delivery
• Notifications on your phone when your order moves forward
• An invoice for every order, always at hand in the app

TALK TO US
• Chat with Royal Tiara directly in the app
• Questions about stock, delivery or payment, answered by the team

YOUR ACCOUNT, YOUR DATA
• Your details are only used to run your trade account and deliver your orders, and are never sold
• Delete your account at any time from the app

Royal Tiara Trade is for trade customers in South Africa. Not a distributor yet? Download the app and tap "Sign up as a distributor".

Questions? Email info@royaltiara.co.za or WhatsApp 075 222 5629.
```

**App icon:** `icon-512.png` (512 × 512)

**Feature graphic:** `feature-graphic-1024x500.png` (1024 × 500)

**Phone screenshots:** everything in `screenshots/` (1080 × 1920), in
number order. Tablet screenshots are optional; skip them.

**Video:** leave empty.

---

## Store settings (Grow users → Store presence → Store settings)

| Field | Answer |
|---|---|
| App or game | App |
| Category | Business |
| Tags | Shopping, Business (pick the closest offered) |
| Contact email | info@royaltiara.co.za |
| Phone (optional) | 016 424 1135 |
| Website | https://royaltiara.co.za |

---

## App content (Policy → App content)

**Privacy policy**

```
https://royaltiara.netlify.app/privacy
```

**Ads:** No, my app does not contain ads.

**App access:** All or some functionality is restricted → add instructions:

- Name: `Distributor test account`
- Username: the email of a test distributor account (see "Reviewer account"
  below)
- Password: type it yourself in Play Console. Never paste it into an AI chat.
- Any other information:

```
Royal Tiara Trade is a private ordering app for approved trade customers. Sign in with the test distributor account above to see the catalogue, cart, orders, invoices and chat. Card payments go to PayFast (real payments); there is no need to complete a payment to review the app. New users can tap "Sign up as a distributor" to see the application form; applications are approved by Royal Tiara.
```

**Content rating:** start the questionnaire.

- Email: info@royaltiara.co.za
- Category: **All other app types** (not a game, not social, not
  entertainment)
- Violence, sexual content, profanity, drugs, gambling: **No** to all
- Does the app let users interact or exchange content? **Yes**: users
  can send messages to the business (Royal Tiara) in the app. Users cannot
  message each other or share content publicly.
- Does the app share the user's location with others? **No**
- Does the app allow purchases of digital goods? **No** (it sells physical
  products)
- Expected result: rated for everyone or teen, which is fine.

**Target audience and content:** Age groups: **18 and over** only. Not
designed for children.

**News app:** No. **Health apps:** My app does not have any health features.
**Government app:** No. **Financial features:** My app doesn't provide any
financial features (it takes payments for products through PayFast; that is
not a financial service).

**Data safety** (answer as below)

*Data collection and security*

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes |
| Do you provide a way for users to request that their data is deleted? | Yes |

*Data types collected* (tick these; for each: **Collected**, **not
Shared**, processed **not ephemerally**, required unless noted, purposes as
listed)

| Section | Data type | Required? | Purposes |
|---|---|---|---|
| Personal info | Name | Required | App functionality, Account management |
| Personal info | Email address | Required | App functionality, Account management |
| Personal info | Phone number | Required | App functionality, Account management |
| Personal info | Address | Required | App functionality (delivery) |
| Financial info | Purchase history | Required | App functionality |
| Messages | Other in-app messages | Optional (chat) | App functionality |
| Photos and videos | Photos | Optional (proof of payment) | App functionality |
| Files and docs | Files and docs | Optional (proof of payment as PDF) | App functionality |
| Device or other IDs | Device or other IDs | Optional (only if notifications are turned on) | App functionality |

Why "not shared": the app's service providers (Supabase for the database,
Netlify for hosting, PayFast for card payments) process data on Royal Tiara's
behalf, which Google does not count as sharing. Nothing goes to advertisers.

Do **not** tick: location, payment info (card numbers are entered on PayFast,
not in the app), contacts, calendar, health, web browsing, app activity,
diagnostics.

**Delete account URL**

```
https://royaltiara.netlify.app/delete-account
```

Users can also delete their account inside the app: Account → Delete my
account.

---

## Release notes for version 1.0.0 (max 500)

```
First release of Royal Tiara Trade: sign up as a distributor, order the Royal Tiara range at distributor prices, pay by card or bank transfer, track deliveries, view invoices and chat with Royal Tiara.
```

---

## Reviewer account (set up before submitting)

Google's reviewers need a working distributor login.

1. Sign up in the app with a new email address you control (for example a
   new Gmail), name **Play Reviewer**.
2. As admin, approve it, and mark the joining fee paid (Admin → the person →
   "Joining fee received - mark paid").
3. Put that email and its password in **App access** above (type them in
   Play Console yourself).
4. Reviewers may place test orders. They show in Sales; cancel them there.

---

## Checklist for the first release

1. Play Console account created ($25).
2. Create app → name "Royal Tiara Trade", App, Free, accept the declarations.
3. Fill everything above (Store listing, Store settings, App content).
4. Test and release → Closed testing (or Internal testing first) → create a
   release → upload `twa/RoyalTiara.aab` → release notes above → roll out.
5. App integrity → App signing → copy the **SHA-256 of the app signing key**
   → add it to `public/.well-known/assetlinks.json` (handbook section 17) →
   push → Trigger deploy.
6. Install from Play on a phone and check: no address bar at the top.
7. Personal account: get 12 testers opted in for 14 days, then apply for
   production. Organisation account: you can go to production directly.
