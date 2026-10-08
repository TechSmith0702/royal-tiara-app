import { useSyncExternalStore } from 'react'
import { isInstalledWebApp, isIos, isNativeApp } from './platform.js'

// "Install the app" for the website. Chrome and Edge (Android and computers)
// offer a real install prompt through the beforeinstallprompt event; iPhones
// only allow Share -> Add to Home Screen; other browsers have it in their menu.

let deferredPrompt = null
let installed = isNativeApp || isInstalledWebApp
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn())

/** Call once at start-up, before React renders: Chrome fires the event early. */
export function captureInstallPrompt() {
  if (installed) return
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault() // we show our own button instead of Chrome's banner
    deferredPrompt = event
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

/** 'installed' | 'prompt' (one-tap install) | 'ios' (Add to Home Screen) | 'menu' (use the browser menu) */
function currentState() {
  if (installed) return 'installed'
  if (deferredPrompt) return 'prompt'
  return isIos ? 'ios' : 'menu'
}

export function useInstallState() {
  return useSyncExternalStore(
    fn => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    currentState,
  )
}

/** Opens the browser's install prompt. Returns true if the person installed. */
export async function promptInstall() {
  if (!deferredPrompt) return false
  const prompt = deferredPrompt
  deferredPrompt = null
  prompt.prompt()
  const { outcome } = await prompt.userChoice
  if (outcome === 'accepted') installed = true
  notify()
  return outcome === 'accepted'
}
