import { paymentReturnUrl } from './platform.js'
import { supabase } from './supabase.js'

// PayFast card payments.
//
// The payment is prepared and signed on the server by the payfast-checkout
// Supabase function, which holds the merchant details and passphrase and takes
// the amount from the database. The app only says what is being paid for (an
// order, or the joining fee). PayFast then confirms the payment to the
// payfast-notify function, which marks it paid.

// Only for showing "test mode" notes. The real switch is the PAYFAST_MODE
// secret in Supabase; set VITE_PAYFAST_MODE=live alongside it.
export const isPayfastSandbox = (import.meta.env.VITE_PAYFAST_MODE || 'sandbox') !== 'live'

async function problem(error) {
  try {
    const body = await error.context.json()
    if (body && body.error) return body.error
  } catch {
    // not a JSON reply: fall through
  }
  return 'The card payment could not be started. Please try again.'
}

/**
 * Gets the signed payment from the server and sends the browser to PayFast.
 * `comeBackTo` is the page the distributor lands on if they leave PayFast
 * without finishing (the X in the installed app, or Back).
 */
async function sendToPayfast(body, comeBackTo) {
  const { data, error } = await supabase.functions.invoke('payfast-checkout', { body })
  if (error) throw new Error(await problem(error))

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = data.action
  form.style.display = 'none'
  Object.entries(data.fields).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = String(value)
    form.appendChild(input)
  })
  document.body.appendChild(form)

  // Landing back on this page rather than an empty checkout. A page the
  // browser restores from memory is reloaded so it shows up to date.
  window.history.replaceState(window.history.state, '', comeBackTo)
  window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload() }, { once: true })

  form.submit()
}

/** Pays an order by card. */
export function goToPayfast(order) {
  return sendToPayfast({
    orderId: order.id,
    returnUrl: paymentReturnUrl('/payment/return?order=' + order.id),
    cancelUrl: paymentReturnUrl('/payment/cancel?order=' + order.id),
  }, '/orders/' + order.id)
}

/** Pays the once-off joining fee by card. */
export function goToPayfastJoiningFee() {
  return sendToPayfast({
    joiningFee: true,
    returnUrl: paymentReturnUrl('/join-fee?paid=1'),
    cancelUrl: paymentReturnUrl('/join-fee?cancelled=1'),
  }, '/join-fee?paid=1')
}
