import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { setNewPassword, useAuth } from '../lib/auth.jsx'

/**
 * Where the "forgot password" email link lands. Supabase signs the person in
 * when they open that link, so all that is left is choosing a new password.
 */
export default function NewPassword() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      navigate(user.role === 'admin' ? '/admin' : '/account?saved=password', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen signin">
      <div className="signin-logo">
        <img className="logo-img" src="/logo.png" alt="Royal Tiara" width="640" height="351" />
      </div>

      <div className="signin-body">
        {!user ? (
          <div className="stack gap-14">
            <p className="lede mb-0">That link has expired.</p>
            <p className="hint mb-0">
              Reset links can only be used once, and they stop working after an hour. Ask for a new one and open it
              from the same phone or laptop.
            </p>
            <Link className="btn btn-primary" to="/signin">Back to sign in</Link>
          </div>
        ) : (
          <form className="stack gap-14" onSubmit={save}>
            <div>
              <h1 className="title-sm mb-2">Choose a new password</h1>
              <p className="hint mb-0">For {user.email}</p>
            </div>

            <label className="field-label">
              New password
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>

            <label className="field-label">
              Type it again
              <input
                className="field"
                type="password"
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
