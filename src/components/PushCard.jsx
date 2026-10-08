import { useEffect, useState } from 'react'
import { disablePush, enablePush, pushStatus } from '../lib/push.js'

/**
 * Turns lock-screen notifications on or off for this phone. Shown on the
 * Notifications and Account screens and in the admin console.
 */
export default function PushCard({ audience = 'distributor' }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    pushStatus().then(setStatus).catch(() => setStatus('unsupported'))
  }, [])

  // Nothing to offer: inside the store apps, or a browser without notifications.
  if (!status || status === 'unsupported') return null

  const what = audience === 'admin'
    ? 'new orders, proofs of payment, applications and messages'
    : 'payments, packing, delivery and messages from Royal Tiara'

  const change = async turnOn => {
    setError('')
    setBusy(true)
    try {
      if (turnOn) await enablePush()
      else await disablePush()
      setStatus(await pushStatus())
    } catch (e) {
      setError(e.message)
      setStatus(await pushStatus())
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card card-pad stack gap-10">
      <div className="kicker muted">Phone notifications</div>

      {status === 'on' && (
        <>
          <p className="body-muted mb-0">On for this phone. You will be told about {what}, even when the app is closed.</p>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => change(false)}>
            {busy ? 'Turning off...' : 'Turn off'}
          </button>
        </>
      )}

      {status === 'off' && (
        <>
          <p className="body-muted mb-0">Get a notification on this phone about {what}.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => change(true)}>
            {busy ? 'Turning on...' : 'Turn on notifications'}
          </button>
        </>
      )}

      {status === 'blocked' && (
        <p className="body-muted mb-0">
          Notifications are blocked for Royal Tiara. To allow them, open your phone or browser settings, find this
          site or app, and switch notifications on.
        </p>
      )}

      {status === 'home-screen' && (
        <p className="body-muted mb-0">
          On iPhone, add Royal Tiara to your home screen first: tap <strong>Share</strong>, then{' '}
          <strong>Add to Home Screen</strong>. Open it from there to turn on notifications.
        </p>
      )}

      {error && <p className="form-error mb-0" role="alert">{error}</p>}
    </section>
  )
}
