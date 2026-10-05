import { Capacitor } from '@capacitor/core'

/** True inside the Android (or later iOS) app, false on the website. */
export const isNativeApp = Capacitor.isNativePlatform()

// Inside the app the page address is the phone's own (https://localhost), which
// means nothing in an email. Links that leave the app point at the website.
const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')

/** A link that works from outside the app, e.g. in a password-reset email. */
export const publicUrl = path => (isNativeApp && SITE_URL ? SITE_URL : window.location.origin) + path
