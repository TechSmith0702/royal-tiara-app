// PayFast ITN ("Instant Transaction Notification").
//
// After a distributor pays by card, PayFast calls this function server to
// server to say the money went through. Only then is the order marked paid,
// because the browser coming back to the app proves nothing on its own.
//
// Four checks before anything is believed:
//   1. the message carries a valid signature (when a passphrase is set),
//   2. it came from one of PayFast's own servers,
//   3. PayFast itself confirms the message when we send it back ("validate"),
//   4. the amount matches the order total (checked in the database).
// It must also be for Royal Tiara's own merchant account.
//
// Deploy:  supabase functions deploy payfast-notify --no-verify-jwt
// Secrets: PAYFAST_PASSPHRASE, PAYFAST_MODE (sandbox|live), PAYFAST_MERCHANT_ID
//          (the same secrets as payfast-checkout)
//          SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'

const MODE = Deno.env.get('PAYFAST_MODE') === 'live' ? 'live' : 'sandbox'
const PASSPHRASE = Deno.env.get('PAYFAST_PASSPHRASE') ?? ''
const MERCHANT_ID = Deno.env.get('PAYFAST_MERCHANT_ID') || (MODE === 'sandbox' ? '10000100' : '')
const HOST = MODE === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za'

// PayFast's own servers. A message from anywhere else is ignored.
const ALLOWED_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
]

/**
 * PayFast encodes like PHP's urlencode: spaces as "+", upper-case escapes, and
 * ! ' ( ) * ~ escaped too (encodeURIComponent leaves those alone).
 */
const encode = (value: string) =>
  encodeURIComponent(value.trim())
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+')
    .replace(/%[0-9a-f]{2}/g, m => m.toUpperCase())

async function md5(text: string) {
  const digest = await crypto.subtle.digest('MD5', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** The signature covers every field except the signature itself, in order. */
async function signatureMatches(pairs: [string, string][], sent: string) {
  const base = pairs
    .filter(([k, v]) => k !== 'signature' && v !== '')
    .map(([k, v]) => `${k}=${encode(v)}`)
    .join('&')
  const mine = await md5(PASSPHRASE ? `${base}&passphrase=${encode(PASSPHRASE)}` : base)
  return mine === sent
}

/** Sends the message back to PayFast, which answers VALID or INVALID. */
async function payfastAgrees(body: string) {
  const res = await fetch(`https://${HOST}/eng/query/validate`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  return (await res.text()).trim().toUpperCase().startsWith('VALID')
}

async function cameFromPayfast(req: Request) {
  const forwarded = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  if (!forwarded) return false
  for (const host of ALLOWED_HOSTS) {
    const dns = await fetch(`https://dns.google/resolve?name=${host}&type=A`)
      .then(r => r.json())
      .catch(() => null)
    const ips: string[] = (dns?.Answer ?? []).filter((a: { type: number }) => a.type === 1).map((a: { data: string }) => a.data)
    if (ips.includes(forwarded)) return true
  }
  return false
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const raw = await req.text()
  const pairs = [...new URLSearchParams(raw).entries()] as [string, string][]
  const data = Object.fromEntries(pairs)
  const orderId = data['m_payment_id'] ?? ''
  const amount = Number(data['amount_gross'] ?? '0')
  const reference = data['pf_payment_id'] ?? ''

  // PayFast resends a message it gets no 200 from, so always answer 200 and
  // simply do nothing when something looks wrong.
  const stop = (why: string) => {
    console.log('payfast-notify ignored:', why, orderId)
    return new Response('OK', { status: 200 })
  }

  if (PASSPHRASE && !(await signatureMatches(pairs, data['signature'] ?? ''))) return stop('bad signature')
  if (MERCHANT_ID && data['merchant_id'] !== MERCHANT_ID) return stop('not for this merchant account')
  if (!(await cameFromPayfast(req))) return stop('not from a PayFast server')
  if (!(await payfastAgrees(raw))) return stop('PayFast did not confirm the message')
  if (data['payment_status'] !== 'COMPLETE') return stop(`payment status ${data['payment_status']}`)
  if (!orderId || !(amount > 0)) return stop('missing order or amount')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Joining fees are sent as "JOIN-<distributor id>"; everything else is an order.
  const { data: outcome, error } = orderId.startsWith('JOIN-')
    ? await supabase.rpc('payfast_mark_joining_paid', {
      p_user: orderId.slice('JOIN-'.length),
      p_amount: amount,
      p_reference: reference,
    })
    : await supabase.rpc('payfast_mark_paid', {
      // A balance payment is "RT-2010-B21600"; the order is "RT-2010".
      p_order_id: orderId.replace(/-B\d+$/, ''),
      p_amount: amount,
      p_reference: reference,
    })

  if (error) {
    console.error('payfast-notify database error:', error.message, orderId)
    return new Response('OK', { status: 200 })
  }

  console.log('payfast-notify:', orderId, outcome)
  return new Response('OK', { status: 200 })
})
