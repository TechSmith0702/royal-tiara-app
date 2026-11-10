// Sends lock-screen notifications for new notifications and chat messages:
// Web Push for the website and the Google Play app, and Apple's push service
// (APNs) for the App Store app. The database calls this after each insert
// (see migration-push.sql and migration-native-push.sql).
//
// Nothing in the request is trusted: it only names a row. The row is read with
// the service key, sent to its rightful recipients, and marked pushed_at so it
// is never sent twice. Rows older than ten minutes are ignored.
//
// Deploy:  supabase functions deploy push-send --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//          APNS_KEY (the whole .p8 file), APNS_KEY_ID, APNS_TEAM_ID
//          APNS_HOST (optional: api.sandbox.push.apple.com for Xcode debug builds)
// Without the APNS_ secrets, iPhone-app phones are simply skipped.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@royaltiara.co.za',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const FRESH_MS = 10 * 60 * 1000
const ok = () => new Response('OK', { status: 200 })

type Push = { title: string; body: string; link: string; tag: string }

// ---------------------------------------------------------------------------
// Apple push (APNs). Apple wants a short signed token (JWT) with each request,
// made from the .p8 key; it is reused for 40 minutes (Apple allows up to 60).
const APNS_KEY = Deno.env.get('APNS_KEY') ?? ''
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') ?? ''
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? ''
const APNS_HOST = Deno.env.get('APNS_HOST') || 'api.push.apple.com'
const APNS_TOPIC = 'za.co.royaltiara.trade'
const apnsReady = Boolean(APNS_KEY && APNS_KEY_ID && APNS_TEAM_ID)

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const text64 = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)))

let apnsJwt: { token: string; at: number } | null = null

async function apnsToken() {
  if (apnsJwt && Date.now() - apnsJwt.at < 40 * 60 * 1000) return apnsJwt.token
  const base64 = APNS_KEY.replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const unsigned = text64({ alg: 'ES256', kid: APNS_KEY_ID }) + '.' + text64({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  apnsJwt = { token: unsigned + '.' + b64url(new Uint8Array(signature)), at: Date.now() }
  return apnsJwt.token
}

/** Sends one notification to one iPhone. Returns false if the token is dead. */
async function sendApns(deviceToken: string, push: Push): Promise<boolean> {
  const res = await fetch('https://' + APNS_HOST + '/3/device/' + deviceToken, {
    method: 'POST',
    headers: {
      authorization: 'bearer ' + (await apnsToken()),
      'apns-topic': APNS_TOPIC,
      'apns-push-type': 'alert',
      // 10 = deliver now, like urgency "high" for Web Push.
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 60 * 60 * 24),
      // A newer notification with the same tag replaces the older one, as on the web.
      'apns-collapse-id': push.tag.slice(0, 64),
    },
    body: JSON.stringify({
      aps: { alert: { title: push.title, body: push.body }, sound: 'default', 'thread-id': push.tag },
      link: push.link,
    }),
  })
  if (res.ok) return true
  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? ''
  // The app was deleted, notifications were turned off, or the token belongs
  // to a different kind of build (debug vs App Store).
  if (res.status === 410 || ['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered'].includes(reason)) return false
  if (reason === 'ExpiredProviderToken') apnsJwt = null
  console.error('push-send APNs failed:', res.status, reason)
  return true
}

/** Marks the row as pushed and returns it, or null if it was already pushed. */
async function claim(table: 'notifications' | 'messages', id: number) {
  const { data } = await db
    .from(table)
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', id)
    .is('pushed_at', null)
    .select()
    .maybeSingle()
  if (!data || Date.now() - new Date(data.created_at).getTime() > FRESH_MS) return null
  return data
}

async function forNotification(id: number): Promise<[string[], Push] | null> {
  const n = await claim('notifications', id)
  if (!n) return null
  return [[n.user_id], { title: n.title, body: n.body ?? '', link: n.link ?? '/', tag: 'note-' + n.id }]
}

async function forMessage(id: number): Promise<[string[], Push] | null> {
  const m = await claim('messages', id)
  if (!m) return null
  const text = m.body.length > 140 ? m.body.slice(0, 137) + '...' : m.body

  if (m.sender_id === m.distributor_id) {
    // A distributor wrote: tell the admins.
    const [{ data: sender }, { data: admins }] = await Promise.all([
      db.from('profiles').select('name, business').eq('id', m.sender_id).maybeSingle(),
      db.from('profiles').select('id').eq('role', 'admin'),
    ])
    const who = sender?.business || sender?.name || 'A distributor'
    return [(admins ?? []).map(a => a.id), { title: 'Message from ' + who, body: text, link: '/admin/chat/' + m.distributor_id, tag: 'chat-' + m.distributor_id }]
  }

  // Royal Tiara wrote: tell the distributor.
  return [[m.distributor_id], { title: 'Royal Tiara', body: text, link: '/chat', tag: 'chat-' + m.distributor_id }]
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { kind, id } = await req.json().catch(() => ({}))
  if (!Number.isInteger(id)) return ok()

  const found = kind === 'notification' ? await forNotification(id) : kind === 'message' ? await forMessage(id) : null
  if (!found) return ok()
  const [recipients, push] = found
  if (!recipients.length) return ok()

  const [{ data: subs }, { data: phones }] = await Promise.all([
    db.from('push_subscriptions').select('*').in('user_id', recipients),
    apnsReady
      ? db.from('native_push_tokens').select('id, token').in('user_id', recipients)
      : Promise.resolve({ data: [] as { id: number; token: string }[] }),
  ])

  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(push),
        // "high": Android delivers it at once, even when the phone is idle.
        // Without it, idle phones batch notifications and they arrive minutes late.
        { TTL: 60 * 60 * 24, urgency: 'high' },
      )
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // 404/410: the phone turned notifications off or the app was removed.
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push-send failed:', status, (e as Error).message)
    }
  }))

  await Promise.all((phones ?? []).map(async t => {
    try {
      if (!(await sendApns(t.token, push))) await db.from('native_push_tokens').delete().eq('id', t.id)
    } catch (e) {
      console.error('push-send APNs failed:', (e as Error).message)
    }
  }))

  console.log('push-send:', kind, id, 'to', (subs ?? []).length, 'browser(s) and', (phones ?? []).length, 'iPhone app(s)')
  return ok()
})
