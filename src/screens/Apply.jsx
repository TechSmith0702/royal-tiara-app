import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { signIn, signUp } from '../lib/auth.jsx'
import { JOINING_FEE, fetchFees } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { R, WHATSAPP_DISPLAY } from '../lib/format.js'
import { BackButton, Segmented } from '../components/ui.jsx'

const FIELDS = [
  { key: 'name', label: 'Full name', placeholder: 'e.g. John Smith', autoComplete: 'name', required: true },
  { key: 'business', label: 'Business name (optional)', placeholder: 'e.g. Naledi Salon', autoComplete: 'organization' },
  { key: 'address', label: 'Delivery address', placeholder: 'e.g. 25 Main Road, Soweto', autoComplete: 'street-address', required: true },
  { key: 'town', label: 'Town / province', placeholder: 'e.g. Soweto, Gauteng', autoComplete: 'address-level2', required: true },
  { key: 'postal', label: 'Postal code', placeholder: 'e.g. 1911', autoComplete: 'postal-code', inputMode: 'numeric', required: true },
  { key: 'phone', label: 'Phone number', placeholder: 'e.g. 072 123 4567', autoComplete: 'tel', type: 'tel', inputMode: 'tel', required: true },
  { key: 'email', label: 'Email', placeholder: 'e.g. name@email.com', autoComplete: 'email', type: 'email', inputMode: 'email', required: true },
  { key: 'password', label: 'Choose a password', placeholder: 'At least 6 characters', autoComplete: 'new-password', type: 'password', required: true },
]

const EMPTY = { name: '', business: '', address: '', town: '', postal: '', phone: '', email: '', password: '' }

export default function Apply() {
  const { data: fees } = useLive(fetchFees, ['settings'], [])
  const joiningFee = fees ? fees.joining : JOINING_FEE
  const [form, setForm] = useState(EMPTY)
  const [joinPay, setJoinPay] = useState('card')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [checking, setChecking] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const lastTry = useRef(0)

  // Once the email is confirmed (often in the email app, not here), signing in
  // works. Success signs them in, and the app moves on to the waiting screen.
  const trySignIn = useCallback(async showError => {
    if (!done || !done.needsEmailConfirmation) return
    lastTry.current = Date.now()
    setChecking(true)
    setConfirmError('')
    try {
      await signIn(done.email, done.password)
    } catch (err) {
      if (showError) setConfirmError(err.message)
    } finally {
      setChecking(false)
    }
  }, [done])

  // Try quietly whenever they come back to the app, e.g. from their email.
  useEffect(() => {
    if (!done || !done.needsEmailConfirmation) return
    const back = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastTry.current > 5000) trySignIn(false)
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
    }
  }, [done, trySignIn])

  const submit = async e => {
    e.preventDefault()
    setError('')

    const clean = {}
    Object.keys(form).forEach(k => { clean[k] = form[k].trim() })
    const missing = FIELDS.filter(f => f.required && !clean[f.key])
    if (missing.length) {
      setError('Please fill in ' + missing.map(f => f.label.toLowerCase()).join(', ') + '.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(clean.email)) {
      setError('That email address does not look right.')
      return
    }
    if (clean.password.length < 6) {
      setError('Your password must be at least 6 characters.')
      return
    }

    setBusy(true)
    try {
      // The postal code is stored on the same line as the town, e.g. "Soweto, Gauteng, 1804".
      const town = clean.postal ? clean.town + ', ' + clean.postal : clean.town
      const result = await signUp({ ...clean, town, joinPay })
      // Kept in memory only, to sign them in once they have confirmed their email.
      setDone({ joinPay, needsEmailConfirmation: result.needsEmailConfirmation, email: clean.email, password: clean.password })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to="/signin" />
        <h2 className="title-sm">Trade application</h2>
      </div>

      <div className="scroll px-22 pb-24 pt-8">
        {done ? (
          <div className="success-card stack gap-12">
            <div className="check-circle">&#10003;</div>
            <h3 className="h3">Application received</h3>
            <p className="success-text">
              {done.needsEmailConfirmation
                ? 'Please confirm your email address first - we sent you a link. After that, Royal Tiara reviews trade accounts within one working day.'
                : 'Royal Tiara reviews trade accounts within one working day. You can chat to us in the app in the meantime.'}
            </p>
            <p className="success-text">
              {done.joinPay === 'card'
                ? 'Your ' + R(joiningFee) + ' joining fee is payable once your account is approved.'
                : 'Send your ' + R(joiningFee) + ' joining-fee proof on WhatsApp (' + WHATSAPP_DISPLAY + ') so we can activate your account.'}
            </p>
            {done.needsEmailConfirmation && (
              <>
                <button type="button" className="btn btn-primary" disabled={checking} onClick={() => trySignIn(true)}>
                  {checking ? 'Checking...' : "I've confirmed my email"}
                </button>
                {confirmError && <p className="form-error mb-0" role="alert">{confirmError}</p>}
              </>
            )}
            <Link to="/signin" className={done.needsEmailConfirmation ? 'btn btn-outline' : 'btn btn-sage'}>Back to sign in</Link>
          </div>
        ) : (
          <form className="stack gap-14" onSubmit={submit} noValidate>
            {FIELDS.map(f => (
              <label key={f.key} className="field-label">
                {f.label}
                <input
                  className="field"
                  type={f.type || 'text'}
                  inputMode={f.inputMode}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </label>
            ))}

            <div className="card-dark stack gap-12 mt-4">
              <div className="row between baseline gap-12">
                <span className="kicker on-dark">Once-off joining fee</span>
                <span className="fee">{R(joiningFee)}</span>
              </div>
              <p className="on-dark-text">
                Activates your distributor account and unlocks ordering. Paid once - no monthly fees.
              </p>
              <Segmented
                dark
                value={joinPay}
                onChange={setJoinPay}
                options={[{ value: 'card', label: 'Card' }, { value: 'eft', label: 'Bank transfer' }]}
              />
              <div className="on-dark-note">
                {joinPay === 'card'
                  ? 'You will pay securely on PayFast once your account is approved.'
                  : 'Transfer the fee and send proof on WhatsApp - we activate once it reflects.'}
              </div>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <p className="hint mb-0">
              Royal Tiara uses these details to check your application, price your orders and deliver them. They are
              never sold. You can delete your account at any time. <Link to="/privacy" className="link-inline">Privacy policy</Link>
            </p>

            <button type="submit" className="btn btn-primary mt-4" disabled={busy}>
              {busy ? 'Sending...' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
