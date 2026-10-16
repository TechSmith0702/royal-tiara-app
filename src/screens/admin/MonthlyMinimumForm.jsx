import { useEffect, useState } from 'react'
import { adminSaveMonthlyMinimum, fetchFees, monthlyMinLabel } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { Segmented } from '../../components/ui.jsx'

const onlyNumber = value => value.replace(/[^0-9.]/g, '')

/**
 * How much a distributor must order each month to keep their discount. Shown
 * as a tick box on the trade application and in the distributor terms.
 */
export default function MonthlyMinimumForm() {
  const { data, refresh } = useLive(fetchFees, ['settings'], [])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (data && !form) {
      setForm({ amount: String(data.monthlyMin), unit: data.monthlyMinUnit, discount: String(data.discount) })
    }
  }, [data, form])

  if (!form) return null

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setSaved('')
  }

  const amount = Number(form.amount) || 0
  const discount = Number(form.discount) || 0
  const changed = data && (amount !== data.monthlyMin || form.unit !== data.monthlyMinUnit || discount !== data.discount)
  const preview = { monthlyMin: amount, monthlyMinUnit: form.unit, discount }

  const save = async () => {
    setBusy(true)
    setProblem('')
    setSaved('')
    try {
      await adminSaveMonthlyMinimum(amount, form.unit, discount)
      refresh()
      setSaved(amount > 0 ? 'Saved. New applicants must tick that they accept it.' : 'Saved. There is no monthly minimum.')
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card card-pad stack gap-12">
      <div>
        <div className="kicker muted">Monthly minimum</div>
        <p className="hint mb-0">
          What a distributor must order each month to keep their discount. Applicants tick that they accept it, and it
          is added to the distributor terms. Set it to 0 for no minimum.
        </p>
      </div>

      <Segmented
        value={form.unit}
        onChange={v => set('unit', v)}
        options={[{ value: 'rand', label: 'Rand value' }, { value: 'products', label: 'Number of products' }]}
      />

      <div className="row gap-10">
        <label className="field-label grow">
          {form.unit === 'rand' ? 'Minimum per month (R)' : 'Products per month'}
          <input
            className="field"
            inputMode={form.unit === 'rand' ? 'decimal' : 'numeric'}
            value={form.amount}
            onChange={e => set('amount', onlyNumber(e.target.value))}
          />
        </label>
        <label className="field-label grow">
          Discount (%)
          <input
            className="field"
            inputMode="numeric"
            value={form.discount}
            onChange={e => set('discount', e.target.value.replace(/\D/g, ''))}
          />
        </label>
      </div>

      <p className="hint mb-0">
        {amount > 0
          ? 'Applicants will see: "To keep my ' + discount + '% distributor discount, I must order at least '
            + monthlyMinLabel(preview) + ' every month."'
          : 'No minimum: the application has no tick box for it.'}
      </p>

      {problem && <p className="form-error" role="alert">{problem}</p>}
      {saved && <p className="form-note" role="status">{saved}</p>}

      <button type="button" className="btn btn-primary btn-46" onClick={save} disabled={busy || !changed}>
        {busy ? 'Saving...' : changed ? 'Save monthly minimum' : 'Saved'}
      </button>
    </section>
  )
}
