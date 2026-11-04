import { Capacitor } from '@capacitor/core'

/** True inside the Android or iPhone app, false on the website. */
export const isNativeApp = Capacitor.isNativePlatform()

/** An iPhone or iPad (iPads report themselves as a Mac with a touch screen). */
export const isIos =
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Opened from a home-screen icon (installed web app), not a browser tab. */
export const isInstalledWebApp =
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

// The Google Play app (a Trusted Web Activity) opens the site with this
// referrer. It shares Chrome's storage, so remembering it lets a Chrome tab
// (e.g. opened from a password-reset email) know the app is on this phone.
const PLAY_PACKAGE = 'za.co.royaltiara.trade'
try {
  if (document.referrer.startsWith('android-app://' + PLAY_PACKAGE)) localStorage.setItem('rt-play-app', '1')
} catch {
  // Storage blocked: the "Open the app" button just stays hidden.
}

/** In a browser tab on an Android phone that has the Google Play app. */
export const canOpenPlayApp = () => {
  try {
    return /Android/.test(navigator.userAgent) && !isInstalledWebApp && !isNativeApp && localStorage.getItem('rt-play-app') === '1'
  } catch {
    return false
  }
}

/** Opens `path` in the Google Play app; stays on this site if the app is gone. */
export const playAppLink = path =>
  'intent://' + window.location.host + path + '#Intent;scheme=https;package=' + PLAY_PACKAGE +
  ';S.browser_fallback_url=' + encodeURIComponent(window.location.origin + path) + ';end'

// Inside the app the page address is the phone's own (https://localhost on
// Android, capacitor://localhost on iPhone), which means nothing in an email.
// Links that leave the app point at the website.
const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')

/** A link that works from outside the app, e.g. in a password-reset email. */
export const publicUrl = path => (isNativeApp && SITE_URL ? SITE_URL : window.location.origin) + path

/**
 * Where PayFast sends the distributor back to after paying. Live PayFast refuses
 * return addresses at "localhost" (where both apps live) and anything that is not
 * https://, so inside the apps it goes through public/app-return.html on the
 * website, which hands straight back to the app.
 */
export const paymentReturnUrl = path =>
  isNativeApp && SITE_URL
    ? SITE_URL + '/app-return.html?to=' + encodeURIComponent(path)
    : window.location.origin + path
