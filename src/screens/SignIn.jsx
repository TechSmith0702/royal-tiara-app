import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resendSignUpCode, sendPasswordReset, signIn, verifySignUpCode, wasJustDeleted } from '../lib/auth.jsx'
import { WHATSAPP_DISPLAY, waLink } from '../lib/format.js'
import InstallCard from '../components/InstallCard.jsx'
import { CodeInput, PasswordInput } from '../components/ui.jsx'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState(() => (wasJustDeleted() ? 'Your account has been deleted.' : ''))
  // Set when they signed up but left before typing the emailed code.
  const [confirmEmail, setConfirmEmail] = useState('')
  const [code, setCode] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    setNote('')
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (err) {
      if (err.unconfirmed) {
        setConfirmEmail(email.trim())
        setCode('')
        setNote('Your email is not confirmed yet. Type the code we emailed you when you signed up, or ask for a new one.')
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  // The code confirms the email and signs them in; the app then moves on by itself.
  const confirmCode = async e => {
    e.preventDefault()
    setError('')
    if (code.length < 6) {
      setError('Type the code from the email.')
      return
    }
    setBusy(true)
    try {
      await verifySignUpCode(confirmEmail, code)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const resendCode = async () => {
    setError('')
    setNote('Sending a new code...')
    try {
      await resendSignUpCode(confirmEmail)
      setCode('')
      setNote('We sent a new code to ' + confirmEmail + '.')
    } catch (err) {
      setNote('')
      setError(err.message)
    }
  }

  const reset = async () => {
    setError('')
    setNote('')
    if (!email.trim()) {
      setError('Type your email address first, then tap this again.')
      return
    }
    // Sending the email takes a few seconds.
    setSending(true)
    try {
      await sendPasswordReset(email)
      navigate('/new-password', { state: { email: email.trim() } })
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <div className="screen signin">
      <div className="signin-logo">
        <img className="logo-img" src="/logo.webp" alt="Royal Tiara" width="640" height="351" />
      </div>

      <div className="signin-body">
        {confirmEmail ? (
          <form className="stack gap-12" onSubmit={confirmCode} noValidate>
            <h3 className="h3 mb-0">Confirm your email</h3>
            {note && <p className="form-note mb-0" role="status">{note}</p>}
            <label className="field-label">
              Code sent to {confirmEmail}
              <CodeInput value={code} onChange={setCode} />
            </label>
            {error && <p className="form-error mb-0" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Checking...' : 'Confirm my email'}
            </button>
            <button type="button" className="text-btn center-self" onClick={resendCode}>Send a new code</button>
            <button
              type="button"
              className="text-btn center-self"
              onClick={() => { setConfirmEmail(''); setError(''); setNote('') }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
        <form className="stack gap-12" onSubmit={submit}>
          <label className="field-label">
            Email
            <input
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Password
            <PasswordInput
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          {note && <p className="form-note" role="status">{note}</p>}

          <button type="submit" className="btn btn-dark" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
          <button type="button" className="text-btn center-self" onClick={reset} disabled={sending}>
            {sending ? 'Sending a code...' : 'Forgot password?'}
          </button>
        </form>
        )}

        <Link to="/apply" className="btn btn-sage">Sign up as a distributor</Link>

        <InstallCard />
      </div>

      <a className="help-line" href={waLink()} target="_blank" rel="noreferrer">
        <span className="dot" />Need help? WhatsApp {WHATSAPP_DISPLAY}
      </a>
      <div className="row center gap-18 foot-links">
        <Link to="/terms" className="link-inline foot-link">Distributor terms</Link>
        <Link to="/privacy" className="link-inline foot-link">Privacy policy</Link>
      </div>
    </div>
  )
}
