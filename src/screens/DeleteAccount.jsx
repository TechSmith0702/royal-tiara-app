import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { forgetDeletedAccount, useAuth } from '../lib/auth.jsx'
import { clearCart } from '../lib/cart.js'
import { deleteMyAccount, fetchOrders } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { BackButton } from '../components/ui.jsx'

/**
 * "Delete my account", for distributors and for anyone whose application is
 * pending or was declined. Reached from the Account page and the waiting page.
 */
export default function DeleteAccount() {
  const { user } = useAuth()
  const { data: orders } = useLive(fetchOrders, ['orders'], [])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!user) return <Navigate to="/signin" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />

  const approved = user.status === 'approved'
  const open = (orders || []).filter(o => o.fulfil !== 'delivered').length
  const confirmed = typed.trim().toUpperCase() === 'DELETE'

  const remove = async () => {
    if (!confirmed) return
    setError('')
    setBusy(true)
    try {
      await deleteMyAccount()
      clearCart(user.id)
      await forgetDeletedAccount() // signs out here, which returns to the sign-in screen
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to={approved ? '/account' : '/pending'} />
        <h2 className="title-sm">Delete my account</h2>
      </div>

      <div className="scroll px-22 pt-8 pb-24 stack gap-14">
        <section className="card card-pad stack gap-10">
          <div className="kicker muted">What is deleted for good</div>
          <ul className="plain-list">
            <li>Your login for {user.email}</li>
            <li>Your name, business name, phone number and delivery address</li>
            <li>Your chat with Royal Tiara</li>
            <li>Your notifications, on every device</li>
          </ul>
        </section>

        <section className="card card-pad stack gap-10">
          <div className="kicker muted">What Royal Tiara keeps</div>
          <p className="body-muted mb-0">
            Orders and invoices you have already placed, with the name and delivery address on them and any proof of
            payment. Sales records have to be kept for tax purposes. They will no longer be linked to an account.
          </p>
          <Link to="/privacy" className="link-inline">Read the privacy policy</Link>
        </section>

        {open > 0 && (
          <p className="form-note mb-0" role="status">
            You have {open} order{open === 1 ? '' : 's'} not delivered yet. Royal Tiara will still deliver orders that
            are paid for, but you will not be able to track them in the app.
          </p>
        )}

        <section className="card card-pad stack gap-12">
          <p className="body-muted mb-0">
            This cannot be undone. To order again you would have to apply for a new trade account.
          </p>
          <label className="field-label">
            Type DELETE to confirm
            <input
              className="field"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              aria-label="Type DELETE to confirm"
            />
          </label>
          {error && <p className="form-error mb-0" role="alert">{error}</p>}
          <button type="button" className="btn btn-danger btn-52" disabled={busy || !confirmed} onClick={remove}>
            {busy ? 'Deleting...' : 'Delete my account for good'}
          </button>
        </section>
      </div>
    </div>
  )
}
