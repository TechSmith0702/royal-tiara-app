import { useState } from 'react'
import { Link } from 'react-router-dom'
import { signUp } from '../lib/auth.jsx'
import { JOINING_FEE } from '../lib/db.js'
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
  const [form, setForm] = useState(EMPTY)
  const [joinPay, setJoinPay] = useState('card')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

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
      setDone({ joinPay, needsEmailConfirmation: result.needsEmailConfirmation })
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
                ? 'Your ' + R(JOINING_FEE) + ' joining fee is payable once your account is approved.'
                : 'Send your ' + R(JOINING_FEE) + ' joining-fee proof on WhatsApp (' + WHATSAPP_DISPLAY + ') so we can activate your account.'}
            </p>
            <Link to="/signin" className="btn btn-sage">Back to sign in</Link>
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
                <span className="fee">{R(JOINING_FEE)}</span>
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

            <button type="submit" className="btn btn-primary mt-4" disabled={busy}>
              {busy ? 'Sending...' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
