# App Store listing — Royal Tiara (iPhone)

Everything to fill in App Store Connect for the first iPhone release. Most
texts match the Google Play listing (`twa/store-listing/LISTING.md`).
Character limits are Apple's; every text below fits.

---

## New app (App Store Connect → Apps → + → New App)

| Field | Answer |
|---|---|
| Platform | iOS |
| Name (max 30) | `Royal Tiara` (if taken: `Royal Tiara Distributors`) |
| Primary language | English (U.K.) |
| Bundle ID | `za.co.royaltiara.trade` (appears once the app ID exists) |
| SKU | `royal-tiara-ios` (private, anything unique) |
| User access | Full access |

---

## App information

| Field | Answer |
|---|---|
| Subtitle (max 30) | `Distributor ordering app` |
| Category | Business; secondary: Shopping |
| Content rights | Does not contain, show or access third-party content |
| Age rating | See below |

**Age rating questionnaire:** None for every content question (violence,
sexual content, profanity, drugs, gambling, horror, medical). Unrestricted web
access: **No**. Messaging or chat: **Yes** — users can only message Royal Tiara
(the business), not each other. User-generated content shared publicly:
**No**. Expected result: 4+ to 13+, which is fine either way.

---

## Version page (iOS App → 1.0 Prepare for Submission)

**Promotional text** (max 170, can change any time without review)

```
Order the full Royal Tiara range at distributor prices, pay securely and follow every order to your door.
```

**Description** (max 4000)

```
Royal Tiara is the ordering app for Royal Tiara's approved distributors and resellers. Order the full Royal Tiara range at distributor prices, pay securely, and follow every order until it reaches your door.

HOW IT WORKS
1. Sign up as a distributor in the app. It only takes a few minutes.
2. Royal Tiara reviews applications within one working day.
3. Start ordering at distributor prices.

ORDER IN A FEW TAPS
• The full Royal Tiara range with photos, sizes and your distributor prices
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

The app is for trade customers in South Africa. Not a distributor yet? Download the app and tap "Sign up as a distributor".

Questions? Email info@royaltiara.co.za or WhatsApp 075 222 5629.
```

(The joining fee is left out of the description on purpose: see "Notes for
the reviewer".)

**Keywords** (max 100, commas, no spaces)

```
distributor,wholesale,reseller,hair,haircare,beauty,salon,stock,order,trade,South Africa
```

**Support URL:** `https://royaltiara.co.za`
**Marketing URL:** leave empty.
**Copyright:** `2026 Royal Tiara`

**Screenshots:** iPhone 6.9" display, 1320 × 2868, 3 to 10 of them. Not made
yet: take them from the TestFlight build on an iPhone, or from Codemagic's
simulator ("Quick launch"), signed in as the reviewer account, with no real
customer names on screen. iPad screenshots are not needed (iPhone-only app).

**Build:** pick the build Codemagic uploaded (`ios-release` workflow).

**Sign-in required:** Yes → the reviewer account (John Doe,
thandosm1+test@gmail.com). Type the password into App Store Connect
yourself; never paste it into an AI chat.

**Contact information:** your name, email and phone (Apple only).

**Notes for the reviewer**

```
Royal Tiara is a private B2B ordering app for approved trade customers (distributors and resellers) of Royal Tiara, a South African company. Please sign in with the demo account provided to see the catalogue, cart, orders, invoices and chat with Royal Tiara.

All purchases in the app are physical products delivered by courier, paid by card through PayFast (South Africa) or by bank transfer, as allowed under guideline 3.1.3(e). There is no digital content for sale.

New distributors apply in the app ("Sign up as a distributor"); Royal Tiara approves each application. A once-off registration fee for a trade account may apply; it is a fee for a wholesale business relationship with Royal Tiara, not access to digital content, and is currently R0.

There is no need to complete a payment to review the app. Push notifications tell distributors when their order moves forward and when Royal Tiara replies in chat.
```

---

## App Privacy (App Store Connect → App Privacy)

**Privacy policy URL:** `https://royaltiara.netlify.app/privacy`

**Do you or your third-party partners collect data from this app?** Yes.

Tick these data types. For each: **Linked to the user**: Yes. **Used for
tracking**: No. **Purpose**: App Functionality only.

| Category | Data type | Why |
|---|---|---|
| Contact Info | Name | Trade account, invoices |
| Contact Info | Email Address | Sign-in, account emails |
| Contact Info | Phone Number | Delivery, contact |
| Contact Info | Physical Address | Delivery |
| Purchases | Purchase History | Orders and invoices |
| User Content | Photos or Videos | Proof of payment (optional) |
| User Content | Other User Content | Chat messages, proof of payment PDFs |
| Identifiers | Device ID | Notification token (only if turned on) |

Do **not** tick: location, financial info (card numbers are entered on
PayFast, not in the app), contacts, health, browsing history, search history,
usage data, diagnostics, advertising data.

**Tracking:** the app does not track users (no ads, no analytics SDKs), so no
App Tracking Transparency prompt is needed.

---

## Pricing and availability

- Price: **Free**.
- Availability: **South Africa** only (same as Google Play).

## Export compliance

Already answered in the app (`ITSAppUsesNonExemptEncryption` = false: only
standard HTTPS). App Store Connect will not ask.
