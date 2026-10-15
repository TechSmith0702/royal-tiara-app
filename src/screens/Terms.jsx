import { Link } from 'react-router-dom'
import { WHATSAPP_DISPLAY, waLink } from '../lib/format.js'
import { PolicyPage } from './Privacy.jsx'

// Business choices that appear in the terms. Check each with Royal Tiara, and
// update EFFECTIVE (and TERMS_VERSION, which applicants accept) whenever the
// wording changes.
const BUSINESS = 'Royal Tiara'
const CONTACT_EMAIL = 'info@royaltiara.co.za'
const BUSINESS_ADDRESS = ''                 // street address; shown only when filled in
const EFFECTIVE = '15 October 2026'
export const TERMS_VERSION = '2026-10-15'
const DISPATCH = 'within two working days of your payment being verified'
const REPORT_WITHIN = '48 hours'            // to report damaged, missing or wrong items
const UNPAID_CANCEL_DAYS = 7                // unpaid orders may be cancelled after this
const JOINING_FEE_REFUNDABLE = false

const Email = () => <a className="link-inline" href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>
const WhatsApp = () => (
  <a className="link-inline" href={waLink()} target="_blank" rel="noreferrer">WhatsApp {WHATSAPP_DISPLAY}</a>
)

export default function Terms() {
  return (
    <PolicyPage title="Distributor terms">
      <p className="hint">Effective {EFFECTIVE}</p>
      <p>
        These terms apply to every {BUSINESS} trade (distributor) account and every order placed through the{' '}
        {BUSINESS} trade app. By applying for an account or placing an order, you agree to them. Please read them
        with the <Link className="link-inline" to="/privacy">privacy policy</Link>, which explains how your
        information is handled.
      </p>

      <h3>1. Your trade account</h3>
      <ul>
        <li>Trade accounts are for people and businesses who buy {BUSINESS} products to resell. {BUSINESS} decides which applications to approve.</li>
        <li>The details you give must be true and kept up to date, especially your phone number and delivery address.</li>
        <li>Keep your password private. You are responsible for orders placed with your login.</li>
        <li>One account per distributor or business, unless {BUSINESS} agrees otherwise.</li>
      </ul>

      <h3>2. Joining fee</h3>
      <p>
        A once-off joining fee, shown on the application, activates your account. There are no monthly fees.
        {JOINING_FEE_REFUNDABLE
          ? ' If your application is not approved, the fee is refunded in full.'
          : ' The joining fee is not refundable once your account has been approved. If your application is not approved, any joining fee you paid is refunded in full.'}
      </p>

      <h3>3. Prices</h3>
      <ul>
        <li>The app shows your distributor (wholesale) prices, which include VAT where it applies.</li>
        <li>Prices and the delivery fee may change at any time. An order keeps the prices and delivery fee shown when you placed it.</li>
        <li>If a price was shown in obvious error, {BUSINESS} will contact you before packing, and you may cancel the order for a full refund.</li>
      </ul>

      <h3>4. Orders and payment</h3>
      <ul>
        <li>An order is confirmed once {BUSINESS} has verified your payment. Orders are only packed after payment.</li>
        <li>
          <strong>Card:</strong> paid on PayFast's secure page and confirmed automatically.{' '}
          <strong>Bank transfer:</strong> pay the exact amount into the account shown in the app, use your order
          number as the reference, and upload your proof of payment. {BUSINESS} verifies it once the money reflects,
          which can take up to two working days between different banks.
        </li>
        <li>You can cancel an unpaid order in the app. {BUSINESS} may cancel orders that are still unpaid after {UNPAID_CANCEL_DAYS} days.</li>
        <li>Once an order is paid, ask {BUSINESS} in the app's chat if you need to change or cancel it. It cannot be changed once it has been collected by the courier.</li>
        <li>Stock is limited. If a paid item turns out to be unavailable, {BUSINESS} will offer you a replacement or refund that item.</li>
      </ul>

      <h3>5. Delivery</h3>
      <ul>
        <li>Orders are handed to the courier {DISPATCH}. Delivery times after that depend on the courier and your area.</li>
        <li>The delivery fee shown at checkout is added to each order.</li>
        <li>Please make sure someone can receive the parcel at the delivery address. Extra courier costs caused by a wrong address or a missed delivery may be charged to you.</li>
        <li>Check your parcel when it arrives and confirm delivery in the app.</li>
      </ul>

      <h3>6. Damaged, missing or wrong items</h3>
      <ul>
        <li>Report damaged, missing or wrong items within {REPORT_WITHIN} of delivery in the app's chat, with photos of the parcel and products.</li>
        <li>{BUSINESS} will replace the item or refund it, including any delivery cost to return it.</li>
        <li>Products that are faulty or not of good quality are covered as the Consumer Protection Act requires: within six months of delivery, you may return them for a repair, replacement or refund.</li>
        <li>Products in good condition that you no longer want are not taken back, unless {BUSINESS} agrees to it in writing.</li>
      </ul>

      <h3>7. Reselling {BUSINESS} products</h3>
      <ul>
        <li>You set your own selling prices.</li>
        <li>Sell the products in their original, sealed packaging. Do not refill, relabel, dilute or repackage them.</li>
        <li>Only make claims about the products that {BUSINESS} makes on its labels and in the app. Do not promise medical results.</li>
        <li>You may use the {BUSINESS} name, logo and product photos to sell genuine {BUSINESS} products. Do not present yourself as {BUSINESS} itself, or use its name for anything else, without permission.</li>
        <li>Store products out of direct sunlight and heat, and do not sell products that are past their best or damaged.</li>
      </ul>

      <h3>8. Putting an account on hold</h3>
      <p>
        {BUSINESS} may put an account on hold, or close it, if these terms are broken (for example repeated unpaid
        orders, repackaged products or misleading claims). You keep access to your past orders and invoices, and
        any paid orders are still delivered or refunded. You can delete your own account at any time from the
        Account page.
      </p>

      <h3>9. Responsibility</h3>
      <p>
        Use and sell the products as their labels direct. As far as the law allows, {BUSINESS} is not responsible
        for indirect losses such as lost profit, and its responsibility for any order is limited to the amount paid
        for that order. Nothing in these terms takes away rights you have under the Consumer Protection Act or other
        South African law.
      </p>

      <h3>10. Changes and the law</h3>
      <p>
        {BUSINESS} may update these terms. The new version will be published here with a new effective date, and
        orders placed after that follow it. These terms are governed by the law of South Africa.
      </p>

      <h3>11. Contact</h3>
      <p>
        {BUSINESS}{BUSINESS_ADDRESS && ', ' + BUSINESS_ADDRESS}. Use the chat in the app, <WhatsApp />, or email <Email />.
      </p>
    </PolicyPage>
  )
}
