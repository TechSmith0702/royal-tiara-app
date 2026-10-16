// Sends lock-screen notifications (Web Push) for new notifications and chat
// messages. The database calls this after each insert (see migration-push.sql).
//
// Nothing in the request is trusted: it only names a row. The row is read with
// the service key, sent to its rightful recipients, and marked pushed_at so it
// is never sent twice. Rows older than ten minutes are ignored.
//
// Deploy:  supabase functions deploy push-send --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

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

  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', recipients)

  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(push),
        { TTL: 60 * 60 * 24 },
      )
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // 404/410: the phone turned notifications off or the app was removed.
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push-send failed:', status, (e as Error).message)
    }
  }))

  console.log('push-send:', kind, id, 'to', (subs ?? []).length, 'device(s)')
  return ok()
})
