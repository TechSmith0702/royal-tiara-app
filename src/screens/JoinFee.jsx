import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { signOut, useAuth } from '../lib/auth.jsx'
import { fetchFees } from '../lib/db.js'
import { R, WHATSAPP_DISPLAY, waLink } from '../lib/format.js'
import { useLive } from '../lib/live.js'
import { goToPayfastJoiningFee, isPayfastSandbox } from '../lib/payfast.js'
import BankDetails from '../components/BankDetails.jsx'

// PayFast confirms within seconds of the distributor coming back.
const CONFIRM_WINDOW_MS = 30 * 1000

/**
 * Approved, but the joining fee is not paid yet. Ordering unlocks by itself
 * the moment the payment is confirmed: the profile updates live and the app
 * moves on to the home screen.
 */
export default function JoinFee() {
  const { user } = useAuth()
  const { data: fees } = useLive(fetchFees, ['settings'], [])
  const [params, setParams] = useSearchParams()
  const cameBack = params.get('paid') === '1'
  const cancelled = params.get('cancelled') === '1'
  const [confirming, setConfirming] = useState(cameBack)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Stop waiting after a while: the payment most likely did not go through.
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [confirming])

  const fee = fees ? fees.joining : null
  const first = user.name.split(' ')[0]
  // Bank references allow about 20 characters.
  const reference = ('JOIN ' + user.name).toUpperCase().slice(0, 20)

  const pay = async () => {
    setError('')
    setBusy(true)
    try {
      await goToPayfastJoiningFee()   // leaves the app for PayFast
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const tryAgain = () => {
    setConfirming(false)
    setParams({}, { replace: true })
  }

  return (
    <div className="screen">
      <div className="scroll page stack gap-18">
        <div className="signin-logo"><img className="logo-img logo-sm" src="/logo.webp" alt="Royal Tiara" width="640" height="351" /></div>

        <div className="success-card stack gap-12">
          <h2 className="h3">Welcome, {first}!</h2>
          <p className="success-text mb-0">
            {fee === 0
              ? 'Your trade account is approved. Royal Tiara will unlock ordering for you shortly.'
              : 'Your trade account is approved. Pay the once-off joining fee to start ordering at distributor prices.'}
          </p>
        </div>

        {fee === 0 ? (
          <section className="card card-pad stack gap-10">
            <div className="kicker muted">No joining fee</div>
            <p className="body-muted mb-0">
              There is no joining fee at the moment, so there is nothing to pay. If ordering is not unlocked soon, chat to
              Royal Tiara.
            </p>
          </section>
        ) : confirming ? (
          <section className="card card-pad stack gap-12" role="status">
            <div className="row center gap-10">
              <span className="spinner" aria-hidden="true" />
              <strong>Confirming your payment...</strong>
            </div>
            <p className="body-muted mb-0">
              PayFast usually confirms within a few seconds. The shop opens by itself, so there is no need to pay again.
            </p>
            <button type="button" className="link-inline link-btn retry-link" onClick={tryAgain}>
              Payment didn't go through?
            </button>
          </section>
        ) : (
          <section className="card-dark stack gap-14">
            <div className="row between center">
              <span className="kicker on-dark">Once-off joining fee</span>
              <span className="fee">{fee == null ? '…' : R(fee)}</span>
            </div>
            <p className="on-dark-text mb-0">Paid once - no monthly fees.</p>
            {cancelled && <p className="on-dark-note mb-0">Payment cancelled. Nothing was charged.</p>}
            {cameBack && !cancelled && (
              <p className="on-dark-note mb-0">
                We have not received your payment yet. If you have just paid, wait a minute before paying again.
              </p>
            )}
            <button type="button" className="btn btn-primary" disabled={busy || fee == null} onClick={pay}>
              {busy ? 'Opening PayFast...' : 'Pay ' + (fee == null ? '' : R(fee) + ' ') + 'by card'}
            </button>
            {isPayfastSandbox && <p className="on-dark-note mb-0">Test mode - use PayFast's test card, no real money moves.</p>}
            {error && <p className="form-error mb-0" role="alert">{error}</p>}
          </section>
        )}

        {fee !== 0 && <details className="card card-pad items-details">
          <summary>Prefer to pay by bank transfer?</summary>
          <div className="stack gap-10 mt-10">
            <p className="body-muted mb-0">
              Pay into this account, then send your proof of payment in the chat or on WhatsApp {WHATSAPP_DISPLAY}.
              Royal Tiara unlocks your account once it reflects.
            </p>
            <BankDetails amount={fee} reference={reference} />
          </div>
        </details>}

        <div className="card card-pad stack gap-10">
          <div className="kicker muted">Questions?</div>
          <Link to="/chat" className="btn btn-primary">Chat to Royal Tiara</Link>
          <a className="btn btn-outline" href={waLink()} target="_blank" rel="noreferrer">WhatsApp {WHATSAPP_DISPLAY}</a>
        </div>

        <button type="button" className="btn btn-outline btn-50" onClick={signOut}>Sign out</button>

        <div className="row center gap-18 foot-links">
          <Link to="/terms" className="link-inline">Distributor terms</Link>
          <Link to="/account/delete" className="link-danger">Delete my account</Link>
        </div>
      </div>
    </div>
  )
}
