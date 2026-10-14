import { paymentReturnUrl } from './platform.js'
import { supabase } from './supabase.js'

// PayFast card payments.
//
// The payment is prepared and signed on the server by the payfast-checkout
// Supabase function, which holds the merchant details and passphrase and takes
// the amount from the database. The app only sends the order number. PayFast
// then confirms the payment to the payfast-notify function, which marks the
// order paid.

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

/** Gets the signed payment from the server and sends the browser to PayFast. */
export async function goToPayfast(order) {
  const { data, error } = await supabase.functions.invoke('payfast-checkout', {
    body: {
      orderId: order.id,
      returnUrl: paymentReturnUrl('/payment/return?order=' + order.id),
      cancelUrl: paymentReturnUrl('/payment/cancel?order=' + order.id),
    },
  })
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
  form.submit()
}
