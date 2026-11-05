import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { sendPasswordReset, setNewPassword, useAuth, verifyResetCode } from '../lib/auth.jsx'
import { CodeInput, PasswordInput } from '../components/ui.jsx'
import { canOpenPlayApp, playAppLink } from '../lib/platform.js'

/**
 * "Forgot password". The sign-in screen sends the email and opens this page.
 * Typing the emailed code signs the person in (it stays inside the app); the
 * link in the same email lands here already signed in. Either way, all that
 * is left is choosing a new password.
 */
export default function NewPassword() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  // Set once saved, when the reset link opened in a browser tab but the
  // distributor uses the Google Play app: offer to go back to it.
  const [doneNext, setDoneNext] = useState('')
  // Came straight from the sign-in screen, so the email is known and was just sent.
  const fromSignIn = Boolean(location.state?.email)

  const checkCode = async e => {
    e.preventDefault()
    setError('')
    setNote('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Type the email address of your account.')
      return
    }
    if (code.length < 6) {
      setError('Type the code from the email.')
      return
    }
    setBusy(true)
    try {
      // Signs them in; the page then shows the new-password form below.
      await verifyResetCode(email, code)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setNote('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Type the email address of your account first.')
      return
    }
    setNote('Sending a new code...')
    try {
      await sendPasswordReset(email)
      setCode('')
      setNote('We sent a new code to ' + email.trim() + '.')
    } catch (err) {
      setNote('')
      setError(err.message)
    }
  }

  const save = async e => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    if (password !== again) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await setNewPassword(password)
      const next = user.role === 'admin' ? '/admin' : '/account?saved=password'
      if (canOpenPlayApp()) setDoneNext(next)
      else navigate(next, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen signin">
      <div className="signin-logo">
        <img className="logo-img" src="/logo.webp" alt="Royal Tiara" width="640" height="351" />
      </div>

      <div className="signin-body">
        {doneNext ? (
          <div className="stack gap-14">
            <div>
              <h1 className="title-sm mb-2">Password changed</h1>
              <p className="hint mb-0">You are signed in with your new password.</p>
            </div>
            <a className="btn btn-primary" href={playAppLink(doneNext)}>Open the Royal Tiara app</a>
            <Link className="btn btn-outline" to={doneNext} replace>Continue here</Link>
          </div>
        ) : !user ? (
          <form className="stack gap-14" onSubmit={checkCode} noValidate>
            <div>
              <h1 className="title-sm mb-2">Reset your password</h1>
              <p className="hint mb-0">
                {fromSignIn
                  ? 'We emailed a code to ' + email + '. Type it here to choose a new password.'
                  : 'Type the code from your reset email. If you opened an older link, ask for a new code below.'}
              </p>
            </div>

            {!fromSignIn && (
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
                />
              </label>
            )}

            <label className="field-label">
              Code from the email
              <CodeInput value={code} onChange={setCode} autoFocus={fromSignIn} />
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}
            {note && <p className="form-note" role="status">{note}</p>}

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Checking...' : 'Continue'}
            </button>
            <button type="button" className="text-btn center-self" onClick={resend}>Send a new code</button>
            <Link className="btn btn-outline" to="/signin">Back to sign in</Link>
          </form>
        ) : (
          <form className="stack gap-14" onSubmit={save}>
            <div>
              <h1 className="title-sm mb-2">Choose a new password</h1>
              <p className="hint mb-0">For {user.email}</p>
            </div>

            <label className="field-label">
              New password
              <PasswordInput
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>

            <label className="field-label">
              Type it again
              <PasswordInput
                autoComplete="new-password"
                value={again}
                onChange={e => setAgain(e.target.value)}
                placeholder="The same password"
              />
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
