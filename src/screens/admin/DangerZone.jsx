import { useState } from 'react'
import { adminResetTestData } from '../../lib/db.js'
import { deleteAllProofs } from '../../lib/files.js'

/**
 * Testing tool: clears orders, chat and notifications so you can start
 * over. Accounts, the catalogue and prices are kept.
 */
export default function DangerZone() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')

  const reset = async () => {
    setError('')
    const typed = window.prompt(
      'This permanently deletes ALL orders, invoices, chat messages, notifications and uploaded proof files.\n\n' +
      'Accounts, products and prices are kept.\n\n' +
      'Type RESET to confirm:',
    )
    if (typed === null) return
    if (typed.trim().toUpperCase() !== 'RESET') {
      setError('Nothing was deleted - you did not type RESET.')
      return
    }

    setBusy(true)
    setDone(null)
    try {
      const counts = await adminResetTestData()
      let files = 0
      try {
        files = await deleteAllProofs()
      } catch (e) {
        setError('Data cleared, but the proof files could not be removed: ' + e.message)
      }
      setDone({ ...counts, files })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="danger-zone">
      <button type="button" className="danger-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="grow">Testing tools</span>
        <span className="chev">{open ? '\u2303' : '\u2304'}</span>
      </button>

      {open && (
        <div className="stack gap-10 mt-12">
          <p className="hint mb-0">
            Clears every order, invoice, chat message, notification and uploaded proof of payment, and puts all
            products back in stock. Accounts, products and prices are kept, and order numbers start at RT-2001 again.
            Use this only while testing - once real distributors are ordering, their history would be lost.
          </p>

          {done && (
            <p className="form-note" role="status">
              Cleared {done.orders} orders, {done.messages} messages, {done.notifications} notifications
              {done.files ? ', ' + done.files + ' proof files' : ''}
              {done.restocked ? ', and restocked ' + done.restocked + ' products' : ''}.
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="button" className="btn btn-danger btn-46" onClick={reset} disabled={busy}>
            {busy ? 'Clearing...' : 'Clear all test data'}
          </button>
        </div>
      )}
    </section>
  )
}
