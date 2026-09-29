import { useState } from 'react'
import { updateProfile } from '../lib/db.js'

export default function AddressCard({ user, title = 'Deliver to' }) {
  const [editing, setEditing] = useState(false)
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const address = user.address || {}

  const startEdit = () => {
    setLine1(address.line1 || '')
    setLine2(address.line2 || '')
    setError('')
    setEditing(true)
  }

  const save = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateProfile(user.id, { address: { line1: line1.trim(), line2: line2.trim() } })
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card card-pad">
      <div className="kicker muted">{title}</div>
      <div className="addr-name">{user.business || user.name}</div>

      {editing ? (
        <form className="stack gap-10 mt-12" onSubmit={save}>
          <input
            className="field field-sm"
            value={line1}
            onChange={e => setLine1(e.target.value)}
            placeholder="Street address"
            aria-label="Street address"
            autoComplete="street-address"
            required
          />
          <input
            className="field field-sm"
            value={line2}
            onChange={e => setLine2(e.target.value)}
            placeholder="Town, province, postal code"
            aria-label="Town, province and postal code"
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row gap-9">
            <button type="submit" className="btn btn-primary btn-sm grow" disabled={busy}>
              {busy ? 'Saving...' : 'Save address'}
            </button>
            <button type="button" className="btn btn-outline btn-sm grow" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="addr-lines">
            {address.line1 || 'No delivery address yet'}
            {address.line2 && <><br />{address.line2}</>}
          </div>
          <button type="button" className="btn btn-outline btn-sm btn-inline mt-12" onClick={startEdit}>
            Change address
          </button>
        </>
      )}
    </section>
  )
}
