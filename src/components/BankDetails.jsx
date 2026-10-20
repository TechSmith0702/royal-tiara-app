import { useState } from 'react'
import { fetchBankDetails } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { R, WHATSAPP_DISPLAY, waLink } from '../lib/format.js'

/** A value with a Copy button, so nobody has to retype an account number. */
export function Copyable({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // no clipboard (old browser): the number is still there to read
    }
  }
  return (
    <span className="row center gap-8">
      <strong className="bank-value nowrap">{value}</strong>
      <button type="button" className="copy-btn no-print" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </span>
  )
}

/**
 * Where to send a bank transfer. Without a reference yet (at checkout), it
 * says the order number will be the reference.
 */
export default function BankDetails({ amount, reference }) {
  const { data: bank, loading } = useLive(fetchBankDetails, [], [])

  if (loading) return null
  if (!bank) {
    return (
      <p className="hint mb-0">
        Ask Royal Tiara for the bank details on{' '}
        <a className="link-inline" href={waLink('Hi Royal Tiara, please send me your bank details.')} target="_blank" rel="noreferrer">
          WhatsApp {WHATSAPP_DISPLAY}
        </a>.
      </p>
    )
  }

  return (
    <div className="bank-box">
      <div className="bank-row"><span>Account holder</span><strong className="bank-value">{bank.holder}</strong></div>
      <div className="bank-row"><span>Bank</span><strong className="bank-value">{bank.bank}</strong></div>
      <div className="bank-row"><span>Account number</span><Copyable value={bank.accountNumber} /></div>
      <div className="bank-row"><span>Branch code</span><Copyable value={bank.branchCode} /></div>
      {bank.accountType && <div className="bank-row"><span>Account type</span><strong className="bank-value">{bank.accountType}</strong></div>}
      {amount != null && <div className="bank-row"><span>Amount</span><strong className="bank-value">{R(amount)}</strong></div>}
      <div className="bank-row">
        <span>Reference</span>
        {reference ? <Copyable value={reference} /> : <strong className="bank-value">Your order number</strong>}
      </div>
    </div>
  )
}
