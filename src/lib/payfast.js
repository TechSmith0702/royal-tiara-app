import md5 from 'blueimp-md5'
import { paymentReturnUrl } from './platform.js'

// PayFast redirect (sandbox by default).
//
// The distributor is sent to PayFast, pays, and comes back to the app. PayFast
// also calls a "notify_url" server-to-server to confirm the payment: the
// payfast-notify Supabase function, which marks the order paid.

const MODE = import.meta.env.VITE_PAYFAST_MODE || 'sandbox'
const MERCHANT_ID = import.meta.env.VITE_PAYFAST_MERCHANT_ID
const MERCHANT_KEY = import.meta.env.VITE_PAYFAST_MERCHANT_KEY
const PASSPHRASE = import.meta.env.VITE_PAYFAST_PASSPHRASE || ''
// Where PayFast confirms the payment server-to-server (the Supabase function).
// If it is not set, the admin verifies card orders by hand.
const NOTIFY_URL = import.meta.env.VITE_PAYFAST_NOTIFY_URL || ''

const PROCESS_URL = {
  sandbox: 'https://sandbox.payfast.co.za/eng/process',
  live: 'https://www.payfast.co.za/eng/process',
}

export const isPayfastConfigured = Boolean(MERCHANT_ID && MERCHANT_KEY)
export const isPayfastSandbox = MODE !== 'live'

/** PayFast wants spaces as "+" and percent escapes in upper case. */
const encode = value =>
  encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/%[0-9a-f]{2}/g, m => m.toUpperCase())

export function payfastFields(order, user) {
  const origin = window.location.origin
  const firstName = (user.name || '').split(' ')[0] || 'Customer'
  const lastName = (user.name || '').split(' ').slice(1).join(' ')

  const fields = {
    merchant_id: MERCHANT_ID,
    merchant_key: MERCHANT_KEY,
    return_url: paymentReturnUrl('/payment/return?order=' + order.id),
    cancel_url: paymentReturnUrl('/payment/cancel?order=' + order.id),
    notify_url: NOTIFY_URL || origin + '/payfast-notify',
    name_first: firstName,
    name_last: lastName,
    email_address: user.email,
    m_payment_id: order.id,
    amount: order.total.toFixed(2),
    item_name: 'Royal Tiara order ' + order.id,
  }

  // PayFast only wants a signature when the account has a passphrase set. The
  // shared sandbox account has none, and sending one there is rejected with
  // "Generated signature does not match submitted signature".
  if (!PASSPHRASE) return fields

  // The signature is an MD5 of the fields in this exact order, skipping blanks.
  const base = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => k + '=' + encode(v))
    .join('&')

  const signature = md5(base + '&passphrase=' + encode(PASSPHRASE))
  return { ...fields, signature }
}

/** Builds a hidden form and posts the browser to PayFast. */
export function goToPayfast(order, user) {
  if (!isPayfastConfigured) throw new Error('PayFast is not set up yet.')

  const fields = payfastFields(order, user)
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = PROCESS_URL[isPayfastSandbox ? 'sandbox' : 'live']
  form.style.display = 'none'

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = String(value)
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
}
