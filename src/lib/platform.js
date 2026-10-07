import { Capacitor } from '@capacitor/core'

/** True inside the Android or iPhone app, false on the website. */
export const isNativeApp = Capacitor.isNativePlatform()
const isIosApp = Capacitor.getPlatform() === 'ios'

// Inside the app the page address is the phone's own (https://localhost on
// Android, capacitor://localhost on iPhone), which means nothing in an email.
// Links that leave the app point at the website.
const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')

/** A link that works from outside the app, e.g. in a password-reset email. */
export const publicUrl = path => (isNativeApp && SITE_URL ? SITE_URL : window.location.origin) + path

/**
 * Where PayFast sends the distributor back to after paying. PayFast only accepts
 * https:// addresses, so on iPhone it goes through public/app-return.html on the
 * website, which hands straight back to the app.
 */
export const paymentReturnUrl = path =>
  isIosApp && SITE_URL
    ? SITE_URL + '/app-return.html?to=' + encodeURIComponent(path)
    : window.location.origin + path
