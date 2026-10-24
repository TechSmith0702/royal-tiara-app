import { Link, useLocation, useNavigate } from 'react-router-dom'
import { WHATSAPP_DISPLAY, waLink } from '../lib/format.js'

// The details below appear in the policy. Check them with Royal Tiara before
// relying on the policy, and update EFFECTIVE whenever the wording changes.
const BUSINESS = 'Royal Tiara'
const CONTACT_EMAIL = 'info@royaltiara.co.za'
const INFORMATION_OFFICER = 'Dinah Smith'
const BUSINESS_ADDRESS = 'Meyerton, Midvaal, Gauteng' // from royaltiara.co.za; add the street address if wanted
const EFFECTIVE = '13 October 2026'

/** A plain page that works signed in or out, opened in the app or from a link. */
export function PolicyPage({ title, children }) {
  const navigate = useNavigate()
  const { key } = useLocation()
  // "default" means this page was opened directly, so there is nothing to go back to.
  const back = () => (key === 'default' ? navigate('/') : navigate(-1))

  return (
    <div className="screen">
      <div className="page-top row between center gap-12">
        <h2 className="title-sm">{title}</h2>
        <button type="button" className="btn btn-outline btn-sm btn-inline" onClick={back}>
          {key === 'default' ? 'Open the app' : 'Back'}
        </button>
      </div>
      <div className="scroll px-22 pt-8 pb-24">
        <article className="card card-pad policy">{children}</article>
      </div>
    </div>
  )
}

const Email = () => <a className="link-inline" href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>

export default function Privacy() {
  return (
    <PolicyPage title="Privacy policy">
      <p className="hint">Effective {EFFECTIVE}</p>
      <p>
        This is the privacy policy for the {BUSINESS} trade app, which approved distributors use to order {BUSINESS}{' '}
        products. It explains what personal information the app collects, why, and what you can do about it. It is
        written to meet the Protection of Personal Information Act (POPIA). Ordering is covered by the{' '}
        <Link className="link-inline" to="/terms">distributor terms</Link>.
      </p>

      <h3>Who is responsible</h3>
      <p>
        {BUSINESS} is the responsible party.{BUSINESS_ADDRESS && ' ' + BUSINESS_ADDRESS + '.'} Our Information Officer
        is {INFORMATION_OFFICER}. Email <Email /> or WhatsApp{' '}
        <a className="link-inline" href={waLink()} target="_blank" rel="noreferrer">{WHATSAPP_DISPLAY}</a>.
      </p>

      <h3>What we collect</h3>
      <ul>
        <li><strong>Your account details:</strong> name, business name, email address, phone number and delivery address, which you give us when you sign up as a distributor.</li>
        <li><strong>Your password,</strong> stored in scrambled form. Nobody at {BUSINESS} can see it.</li>
        <li><strong>Your orders:</strong> what you ordered, the amounts, dates, delivery address and the order's progress.</li>
        <li><strong>Proof of payment</strong> files you upload for bank transfers.</li>
        <li><strong>Your chat messages</strong> with {BUSINESS}.</li>
        <li><strong>A notification address for your device,</strong> only if you turn on phone notifications.</li>
      </ul>
      <p>
        We do not collect your card details. Card payments are made on PayFast's own secure page, and the app only
        learns whether the payment succeeded.
      </p>

      <h3>Why we use it</h3>
      <ul>
        <li>To check and approve your trade application.</li>
        <li>To take, price, pack and deliver your orders, and to confirm payments.</li>
        <li>To answer your questions and tell you how an order is progressing.</li>
        <li>To keep the sales and tax records the law requires.</li>
      </ul>
      <p>We do not sell your information, and we do not use it for advertising.</p>

      <h3>Who helps us run the app</h3>
      <p>Your information is handled for us by these service providers, only as needed to run the app:</p>
      <ul>
        <li><strong>Supabase:</strong> stores accounts, orders, chat and uploaded files.</li>
        <li><strong>Netlify:</strong> hosts the app.</li>
        <li><strong>PayFast:</strong> processes card payments.</li>
        <li><strong>Your phone or browser's notification service</strong> (for example Google or Apple): delivers notifications you have turned on.</li>
        <li><strong>Our email provider:</strong> sends sign-up and password emails.</li>
        <li><strong>Our courier:</strong> receives your name, phone number and delivery address to deliver your order.</li>
      </ul>
      <p>
        Some of these providers store information outside South Africa, including in the European Union and the
        United States. They are bound by their own data-protection obligations.
      </p>

      <h3>On your device</h3>
      <p>
        The app keeps you signed in and remembers your cart using storage on your device. It uses no advertising or
        tracking cookies. It loads its fonts from Google Fonts.
      </p>

      <h3>How long we keep it</h3>
      <ul>
        <li>Your account details, chat and notifications: until you delete your account or ask us to.</li>
        <li>
          Orders, invoices and proofs of payment: for as long as tax and company law requires us to keep sales
          records (generally at least five years), even after an account is deleted. After that they are deleted.
        </li>
      </ul>

      <h3>Your rights</h3>
      <ul>
        <li><strong>See it:</strong> your details, orders and invoices are in the app. Ask us for anything else we hold.</li>
        <li><strong>Correct it:</strong> change your delivery address on the Account page. For your name, business name or phone number, ask us and we will correct it.</li>
        <li><strong>Delete it:</strong> see the next section.</li>
        <li><strong>Object or complain:</strong> contact us first. You may also complain to the Information Regulator of South Africa at inforegulator.org.za.</li>
      </ul>

      <h3 id="delete-account">Deleting your account</h3>
      <p>
        In the app, open <strong>Account</strong> and choose <strong>Delete my account</strong>. This removes your
        login, your account details, your chat and your notifications straight away. If you cannot sign in, email{' '}
        <Email /> from the address on your account and we will delete it for you.
      </p>
      <p>
        Orders you have already placed are kept as sales records, as explained above, but are no longer linked to an
        account. <Link className="link-inline" to="/delete-account">More about deleting your account</Link>.
      </p>

      <h3>Security</h3>
      <p>
        The app is only reachable over an encrypted connection. Each distributor can see only their own orders, chat
        and files, and proof-of-payment files are private to you and {BUSINESS}.
      </p>

      <h3>Children</h3>
      <p>The app is for businesses and adult distributors. It is not meant for anyone under 18.</p>

      <h3>Changes</h3>
      <p>If this policy changes, the new version will be published here with a new effective date.</p>
    </PolicyPage>
  )
}

/** Public page the app stores link to: how to delete an account, and what is kept. */
export function DeleteAccountHelp() {
  return (
    <PolicyPage title="Delete your account">
      <p>You can delete your {BUSINESS} trade account at any time.</p>

      <h3>In the app</h3>
      <ol>
        <li>Sign in.</li>
        <li>Open <strong>Account</strong>.</li>
        <li>Choose <strong>Delete my account</strong>, type DELETE and confirm.</li>
      </ol>
      <p>If your application is still being reviewed, the same option is on the waiting screen.</p>

      <h3>If you cannot sign in</h3>
      <p>
        Email <Email /> from the address on your account and ask us to delete it. We will do so as soon as we
        reasonably can.
      </p>

      <h3>What is deleted</h3>
      <ul>
        <li>Your login</li>
        <li>Your name, business name, phone number and delivery address</li>
        <li>Your chat with {BUSINESS}</li>
        <li>Your notifications and notification settings</li>
      </ul>

      <h3>What is kept</h3>
      <p>
        Orders and invoices you have already placed, with the name and delivery address on them and any proof of
        payment, are kept for as long as tax and company law requires (generally at least five years) and then
        deleted. They are no longer linked to an account.
      </p>
      <p><Link className="link-inline" to="/privacy">Read the full privacy policy</Link></p>
    </PolicyPage>
  )
}
