import { Capacitor } from '@capacitor/core'

/** True inside the Android or iPhone app, false on the website. */
export const isNativeApp = Capacitor.isNativePlatform()

/** An iPhone or iPad (iPads report themselves as a Mac with a touch screen). */
export const isIos =
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Opened from a home-screen icon (installed web app), not a browser tab. */
export const isInstalledWebApp =
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

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
