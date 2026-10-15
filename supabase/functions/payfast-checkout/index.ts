// Prepares a PayFast card payment for an order or the joining fee, on the server.
//
// The app sends only the order number and where PayFast should send the
// distributor back to. Everything else comes from here: the amount from the
// database, and the merchant details and passphrase from Supabase secrets. So
// nothing secret is in the website, and a tampered browser cannot change the
// price.
//
// Deploy:  supabase functions deploy payfast-checkout --no-verify-jwt
//          (the caller is checked below, from their sign-in token)
// Secrets: PAYFAST_MODE (sandbox | live), PAYFAST_MERCHANT_ID,
//          PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE. In sandbox mode without
//          them, PayFast's public test account is used.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'

const MODE = Deno.env.get('PAYFAST_MODE') === 'live' ? 'live' : 'sandbox'
const MERCHANT_ID = Deno.env.get('PAYFAST_MERCHANT_ID') || (MODE === 'sandbox' ? '10000100' : '')
const MERCHANT_KEY = Deno.env.get('PAYFAST_MERCHANT_KEY') || (MODE === 'sandbox' ? '46f0cd694581a' : '')
const PASSPHRASE = Deno.env.get('PAYFAST_PASSPHRASE') ?? ''
const PROCESS_URL = MODE === 'live' ? 'https://www.payfast.co.za/eng/process' : 'https://sandbox.payfast.co.za/eng/process'
const NOTIFY_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/payfast-notify'

// Where PayFast may send the distributor back to: the website (and Royal
// Tiara's own domain), the Android app (https://localhost) and a laptop.
const RETURN_HOSTS = [/^royaltiara\.netlify\.app$/, /(^|\.)royaltiara\.co\.za$/, /^localhost$/, /^127\.0\.0\.1$/]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function allowedReturn(value: unknown) {
  try {
    const url = new URL(String(value))
    return (url.protocol === 'https:' || url.protocol === 'http:') && RETURN_HOSTS.some(host => host.test(url.hostname))
  } catch {
    return false
  }
}

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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' })
  if (!MERCHANT_ID || !MERCHANT_KEY) return reply(503, { error: 'Card payments are not set up yet.' })

  // Who is asking: their sign-in token, checked with Supabase.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } }
  const user = auth?.user
  if (!user) return reply(401, { error: 'Please sign in again.' })

  const { orderId, joiningFee, returnUrl, cancelUrl } = await req.json().catch(() => ({}))
  if (!allowedReturn(returnUrl) || !allowedReturn(cancelUrl)) {
    return reply(400, { error: 'That return address is not allowed.' })
  }

  const { data: profile } = await db
    .from('profiles')
    .select('name, role, status, join_fee_paid_at')
    .eq('id', user.id)
    .maybeSingle()

  // What is being paid for: the joining fee, or an order.
  let paymentId: string, amount: number, itemName: string
  if (joiningFee) {
    if (!profile || profile.role !== 'distributor' || profile.status !== 'approved') {
      return reply(409, { error: 'Your trade account is not approved yet.' })
    }
    if (profile.join_fee_paid_at) return reply(409, { error: 'Your joining fee is already paid.' })
    const { data: settings } = await db.from('settings').select('joining_fee').eq('id', true).maybeSingle()
    amount = Number(settings?.joining_fee ?? 0)
    if (!(amount > 0)) return reply(409, { error: 'There is no joining fee to pay.' })
    // payfast-notify recognises joining fees by this prefix.
    paymentId = 'JOIN-' + user.id
    itemName = 'Royal Tiara joining fee'
  } else {
    const { data: order } = await db
      .from('orders')
      .select('id, user_id, total, pay_method, pay_status, proof, fulfil')
      .eq('id', String(orderId ?? ''))
      .maybeSingle()
    if (!order || order.user_id !== user.id) return reply(404, { error: 'That order was not found.' })
    if (order.pay_status === 'verified') return reply(409, { error: 'This order is already paid.' })
    if (order.fulfil === 'cancelled') return reply(409, { error: 'This order was cancelled.' })
    // A bank-transfer order can still be paid by card until a proof is uploaded.
    // It stays a bank-transfer order until PayFast confirms the payment, which
    // then makes it a card order (payfast_mark_paid).
    if (order.pay_method !== 'card' && order.proof) {
      return reply(409, { error: 'You have already uploaded a proof of payment for this order.' })
    }
    paymentId = order.id
    amount = Number(order.total)
    itemName = 'Royal Tiara order ' + order.id
  }

  const names = (profile?.name ?? '').trim().split(/\s+/)

  // In PayFast's documented order. Blank fields are left out of the form and
  // the signature alike.
  const fields = ([
    ['merchant_id', MERCHANT_ID],
    ['merchant_key', MERCHANT_KEY],
    ['return_url', String(returnUrl)],
    ['cancel_url', String(cancelUrl)],
    ['notify_url', NOTIFY_URL],
    ['name_first', names[0] || 'Customer'],
    ['name_last', names.slice(1).join(' ')],
    ['email_address', user.email ?? ''],
    ['m_payment_id', paymentId],
    ['amount', amount.toFixed(2)],
    ['item_name', itemName],
  ] as [string, string][]).filter(([, value]) => value.trim() !== '')

  // PayFast only expects a signature when the account has a passphrase; the
  // shared sandbox account has none and rejects a signed request.
  if (PASSPHRASE) {
    const base = fields.map(([key, value]) => key + '=' + encode(value)).join('&')
    fields.push(['signature', await md5(base + '&passphrase=' + encode(PASSPHRASE))])
  }

  return reply(200, { action: PROCESS_URL, fields: Object.fromEntries(fields), sandbox: MODE === 'sandbox' })
})
