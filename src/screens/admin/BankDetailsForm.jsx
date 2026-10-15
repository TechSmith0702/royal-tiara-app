import { useEffect, useState } from 'react'
import { adminSaveBankDetails, fetchBankDetails } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'

// Universal branch codes, filled in when a bank is picked. Check them against
// the bank's own confirmation letter before saving.
const BANKS = {
  'Absa': '632005',
  'African Bank': '430000',
  'Capitec': '470010',
  'Discovery Bank': '679000',
  'FNB': '250655',
  'Investec': '580105',
  'Nedbank': '198765',
  'Standard Bank': '051001',
  'TymeBank': '678910',
}
const TYPES = ['Cheque / Current', 'Savings', 'Transmission']
const EMPTY = { holder: '', bank: '', accountNumber: '', branchCode: '', accountType: TYPES[0] }

/** Where distributors pay bank transfers, on the Sales tab of the admin console. */
export default function BankDetailsForm() {
  const { data, loading, error, refresh } = useLive(fetchBankDetails, [], [])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (!loading && !form) setForm(data ? { ...data } : EMPTY)
  }, [loading, data, form])

  if (error) return <p className="form-error">Bank details: {error}</p>
  if (!form) return null

  const set = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Picking a bank fills in its universal branch code, unless one was typed by hand.
      if (key === 'bank' && BANKS[value] && (!prev.branchCode || Object.values(BANKS).includes(prev.branchCode))) {
        next.branchCode = BANKS[value]
      }
      return next
    })
    setSaved('')
  }

  const changed = !data || Object.keys(EMPTY).some(k => String(form[k] || '') !== String(data[k] || ''))

  const save = async () => {
    if (data && form.accountNumber.replace(/\D/g, '') !== data.accountNumber) {
      const ok = confirm('Change the account number? Distributors will pay into the new account from now on, and both admins are notified.')
      if (!ok) return
    }
    setBusy(true)
    setProblem('')
    setSaved('')
    try {
      await adminSaveBankDetails(form)
      await refresh()
      setForm(null)   // show the saved, tidied-up values
      setSaved('Saved. Distributors see these details for bank transfers.')
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card card-pad stack gap-12">
      <div>
        <div className="kicker muted">Bank details</div>
        <p className="hint mb-0">
          Shown to distributors paying by bank transfer, at checkout, on their order and on the invoice. Only admins can
          change them, and every change is announced to all admins.
        </p>
      </div>

      <label className="field-label">
        Account holder
        <input className="field" value={form.holder} onChange={e => set('holder', e.target.value)} placeholder="e.g. Royal Tiara" />
      </label>

      <label className="field-label">
        Bank
        <input className="field" list="sa-banks" value={form.bank} onChange={e => set('bank', e.target.value)} placeholder="e.g. FNB" />
        <datalist id="sa-banks">
          {Object.keys(BANKS).map(b => <option key={b} value={b} />)}
        </datalist>
      </label>

      <div className="row gap-10">
        <label className="field-label grow">
          Account number
          <input className="field" inputMode="numeric" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} />
        </label>
        <label className="field-label grow">
          Branch code
          <input className="field" inputMode="numeric" value={form.branchCode} onChange={e => set('branchCode', e.target.value)} />
        </label>
      </div>

      <label className="field-label">
        Account type
        <select className="field" value={form.accountType} onChange={e => set('accountType', e.target.value)}>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      {problem && <p className="form-error" role="alert">{problem}</p>}
      {saved && <p className="form-note" role="status">{saved}</p>}

      <button type="button" className="btn btn-primary btn-46" onClick={save} disabled={busy || !changed}>
        {busy ? 'Saving...' : changed ? 'Save bank details' : 'Saved'}
      </button>
    </section>
  )
}
