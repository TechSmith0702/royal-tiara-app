import { useEffect, useState } from 'react'
import { adminSaveFees, fetchFees } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { R } from '../../lib/format.js'

const onlyPrice = value => value.replace(/[^0-9.]/g, '')

/** Delivery and joining fees, on the Sales tab of the admin console. */
export default function Fees() {
  const { data, refresh } = useLive(fetchFees, ['settings'], [])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (data && !form) setForm({ delivery: String(data.delivery), joining: String(data.joining) })
  }, [data, form])

  if (!form) return null

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: onlyPrice(value) }))
    setSaved('')
  }

  const changed = data && (Number(form.delivery) !== data.delivery || Number(form.joining) !== data.joining)

  const save = async () => {
    setBusy(true)
    setProblem('')
    setSaved('')
    try {
      await adminSaveFees(form.delivery, form.joining)
      refresh()
      setSaved('Saved. New orders use these amounts.')
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card card-pad stack gap-12">
      <div>
        <div className="kicker muted">Fees</div>
        <p className="hint mb-0">
          Delivery is added to every order. The joining fee shows on the trade application. Orders already placed keep
          what they were charged.
        </p>
      </div>

      <div className="row gap-10">
        <label className="field-label grow">
          Delivery per order
          <input
            className="field"
            inputMode="decimal"
            value={form.delivery}
            onChange={e => set('delivery', e.target.value)}
            aria-label="Delivery fee in rand"
          />
        </label>
        <label className="field-label grow">
          Joining fee
          <input
            className="field"
            inputMode="decimal"
            value={form.joining}
            onChange={e => set('joining', e.target.value)}
            aria-label="Joining fee in rand"
          />
        </label>
      </div>

      <p className="hint mb-0">
        Now: {R(Number(form.delivery) || 0)} delivery &middot; {R(Number(form.joining) || 0)} to join.
        {Number(form.delivery) === 0 ? ' Delivery is free.' : ''}
        {form.joining !== '' && Number(form.joining) === 0
          ? ' No joining fee: applicants do not see one, and are unlocked as soon as you approve them.'
          : ' Set the joining fee to 0 to switch it off; put the amount back to switch it on again.'}
      </p>

      {problem && <p className="form-error" role="alert">{problem}</p>}
      {saved && <p className="form-note" role="status">{saved}</p>}

      <button type="button" className="btn btn-primary btn-46" onClick={save} disabled={busy || !changed}>
        {busy ? 'Saving...' : changed ? 'Save fees' : 'Saved'}
      </button>
    </section>
  )
}
