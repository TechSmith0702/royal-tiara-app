import { isInstalledWebApp, isIos, isNativeApp } from './platform.js'
import { supabase } from './supabase.js'

// Lock-screen notifications for the website and the installed (home-screen)
// app, using Web Push. The Play Store / App Store apps run inside a web view
// that has no Web Push, so they will need Firebase/Apple push instead.

// The public half of the key pair. The private half is a Supabase secret.
const VAPID_PUBLIC_KEY = 'BORDwv3PfOQ6OPblNXJ34Ev8uEyM37PkHsIqNmfG89qSYOexHGCESgWmq5yl9foXP937mE1r_z41HPeVi3EtWe4'

export const pushSupported =
  !isNativeApp && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iPhones only allow notifications once the site is added to the home screen. */
export const needsHomeScreen = isIos && !isInstalledWebApp && !isNativeApp

export function registerServiceWorker() {
  if (isNativeApp || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

const toBytes = base64url => {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

async function currentSubscription() {
  if (!pushSupported) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

/** 'on' | 'off' | 'blocked' | 'unsupported' | 'home-screen' for this device. */
export async function pushStatus() {
  if (!pushSupported) return needsHomeScreen ? 'home-screen' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** Asks permission (if needed) and links this device to the signed-in account. */
export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in your browser or phone settings.'
        : 'Notifications were not turned on.',
    )
  }
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID_PUBLIC_KEY) }))
  const { endpoint, keys } = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  })
  if (error) throw new Error(error.message)
}

/** Stops notifications on this device for the signed-in account. */
export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

/** After signing in on a device that already allows notifications, link it again quietly. */
export async function resumePush() {
  if (pushSupported && Notification.permission === 'granted' && (await currentSubscription())) {
    await enablePush()
  }
}
