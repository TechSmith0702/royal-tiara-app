import { useState } from 'react'
import { promptInstall, useInstallState } from '../lib/install.js'

const DISMISS_KEY = 'rt-install-dismissed'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Suggests installing Royal Tiara as an app on this phone or computer. Hidden
 * once it is installed, inside the store apps, or after "Not now".
 */
export default function InstallCard() {
  const state = useInstallState()
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [busy, setBusy] = useState(false)

  if (state === 'installed' || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // private browsing: it simply shows again next time
    }
  }

  const install = async () => {
    setBusy(true)
    try {
      await promptInstall()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card card-pad stack gap-10">
      <div className="row between center">
        <div className="kicker muted">Get the app</div>
        <button type="button" className="text-btn" onClick={dismiss}>Not now</button>
      </div>

      {state === 'prompt' && (
        <>
          <p className="body-muted mb-0">Add Royal Tiara to your phone for one-tap ordering. It updates by itself.</p>
          <button type="button" className="btn btn-primary btn-52" disabled={busy} onClick={install}>
            {busy ? 'Opening...' : 'Install the app'}
          </button>
        </>
      )}

      {state === 'ios' && (
        <p className="body-muted mb-0">
          Add Royal Tiara to your home screen: tap <strong>Share</strong> at the bottom of Safari, then{' '}
          <strong>Add to Home Screen</strong>.
        </p>
      )}

      {state === 'menu' && (
        <p className="body-muted mb-0">
          Add Royal Tiara to your phone: open your browser menu (<strong>&#8942;</strong>) and choose{' '}
          <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      )}
    </section>
  )
}
