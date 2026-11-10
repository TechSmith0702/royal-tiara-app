import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { isInstalledWebApp, isIos, isNativeApp } from './platform.js'
import { supabase } from './supabase.js'

// Lock-screen notifications.
// - Website and installed (home-screen) app: Web Push. The Google Play app is
//   Chrome underneath, so it uses Web Push too.
// - App Store app: its web view has no Web Push, so it uses Apple's own push
//   service (APNs) through the Capacitor plugin. The phone's APNs token is
//   saved with save_native_push_token; push-send sends to both kinds.

/** The App Store app. */
const nativeIos = isNativeApp && Capacitor.getPlatform() === 'ios'
// This phone's APNs token, kept while notifications are on for this phone.
const TOKEN_KEY = 'rt-apns-token'
const savedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const keepToken = token => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage blocked: notifications still work, the card just shows "off".
  }
}

// The public half of the key pair. The private half is a Supabase secret.
const VAPID_PUBLIC_KEY = 'BORDwv3PfOQ6OPblNXJ34Ev8uEyM37PkHsIqNmfG89qSYOexHGCESgWmq5yl9foXP937mE1r_z41HPeVi3EtWe4'

const webPushSupported =
  !isNativeApp && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const pushSupported = nativeIos || webPushSupported

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
  if (!webPushSupported) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

/** 'on' | 'off' | 'blocked' | 'unsupported' | 'home-screen' for this device. */
export async function pushStatus() {
  if (nativeIos) {
    const { receive } = await PushNotifications.checkPermissions()
    if (receive === 'denied') return 'blocked'
    return receive === 'granted' && savedToken() ? 'on' : 'off'
  }
  if (!pushSupported) return needsHomeScreen ? 'home-screen' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** Asks permission (if needed) and links this device to the signed-in account. */
export async function enablePush() {
  if (nativeIos) return enableNativePush()
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
  if (nativeIos) {
    const token = savedToken()
    keepToken(null)
    if (token) await supabase.rpc('remove_native_push_token', { p_token: token })
    await PushNotifications.unregister().catch(() => {})
    return
  }
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

/** After signing in on a device that already allows notifications, link it again quietly. */
export async function resumePush() {
  if (nativeIos) {
    // Apple can change a phone's token, so ask for it again and save the latest.
    if (savedToken() && (await PushNotifications.checkPermissions()).receive === 'granted') await enableNativePush()
    return
  }
  if (webPushSupported && Notification.permission === 'granted' && (await currentSubscription())) {
    await enablePush()
  }
}

// ---------------------------------------------------------------------------
// App Store app (APNs)

/** Asks Apple for this phone's token; resolves with it once Apple answers. */
function registerWithApple() {
  return new Promise((resolve, reject) => {
    const handles = []
    const finish = () => handles.forEach(h => h.then(x => x.remove()))
    const timer = setTimeout(() => {
      finish()
      reject(new Error('The phone did not answer. Check your internet connection and try again.'))
    }, 20000)
    handles.push(
      PushNotifications.addListener('registration', ({ value }) => {
        clearTimeout(timer)
        finish()
        resolve(value)
      }),
      PushNotifications.addListener('registrationError', () => {
        clearTimeout(timer)
        finish()
        reject(new Error('Notifications could not be turned on. Please try again.'))
      }),
    )
    PushNotifications.register().catch(e => {
      clearTimeout(timer)
      finish()
      reject(e)
    })
  })
}

async function enableNativePush() {
  let { receive } = await PushNotifications.checkPermissions()
  if (receive !== 'granted' && receive !== 'denied') receive = (await PushNotifications.requestPermissions()).receive
  if (receive !== 'granted') {
    throw new Error(
      receive === 'denied'
        ? 'Notifications are switched off for Royal Tiara. Turn them on in Settings > Royal Tiara > Notifications.'
        : 'Notifications were not turned on.',
    )
  }
  const token = await registerWithApple()
  const { error } = await supabase.rpc('save_native_push_token', { p_token: token, p_platform: 'ios' })
  if (error) throw new Error(error.message)
  keepToken(token)
}

/**
 * Calls `open(link)` when a notification is tapped in the App Store app.
 * Returns a function that stops listening. Does nothing elsewhere: on the
 * website the service worker opens the page itself.
 */
export function onNotificationTap(open) {
  if (!nativeIos) return () => {}
  const handle = PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const link = notification?.data?.link
    if (typeof link === 'string' && link.startsWith('/')) open(link)
  })
  return () => handle.then(h => h.remove())
}
