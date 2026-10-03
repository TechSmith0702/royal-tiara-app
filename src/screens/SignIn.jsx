import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordReset, signIn } from '../lib/auth.jsx'
import { WHATSAPP_DISPLAY, waLink } from '../lib/format.js'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    setNote('')
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setError('')
    setNote('')
    if (!email.trim()) {
      setError('Type your email address first, then tap this again.')
      return
    }
    try {
      await sendPasswordReset(email)
      setNote('Check your email. The link opens a page where you choose a new password.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="screen signin">
      <div className="signin-logo">
        <img className="logo-img" src="/logo.webp" alt="Royal Tiara" width="640" height="351" />
      </div>

      <div className="signin-body">
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
            <input
              className="field"
              type="password"
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
          <button type="button" className="text-btn center-self" onClick={reset}>Forgot password?</button>
        </form>

        <Link to="/apply" className="btn btn-sage">Apply for a trade account</Link>
      </div>

      <a className="help-line" href={waLink()} target="_blank" rel="noreferrer">
        <span className="dot" />Need help? WhatsApp {WHATSAPP_DISPLAY}
      </a>
    </div>
  )
}
