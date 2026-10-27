import { useState } from 'react'
import { editOrderItems, fetchActiveProducts, requestOrderChange, sizeLabel, unitPrice } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { Loading, Stepper } from './ui.jsx'

const keyOf = (productId, variant) => productId + '/' + (variant == null ? '' : variant)

/**
 * Changes the items on an order before it is packed. Unpaid orders change
 * straight away (request = false); paid ones become a change request that
 * Royal Tiara approves (request = true). The database checks prices and stock
 * again: items already on the order keep the price they were bought at.
 */
export default function ItemEditor({ order, request, paid, onDone, onCancel }) {
  const { data: products, loading } = useLive(fetchActiveProducts, ['products'], [])
  const [qty, setQty] = useState(() => Object.fromEntries(order.lines.map(l => [keyOf(l.productId, l.variant), l.qty])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <section className="card card-pad"><Loading /></section>

  const onOrder = new Map(order.lines.map(l => [keyOf(l.productId, l.variant), l]))
  // One row per product (or per size), with the price the distributor would pay.
  const rows = []
  for (const p of products || []) {
    const variants = p.variants ? p.variants.map((_, i) => i) : [null]
    for (const variant of variants) {
      const key = keyOf(p.id, variant)
      const old = onOrder.get(key)
      // Out of stock: can stay (or shrink) if already ordered, cannot be added.
      if (!p.inStock && !old) continue
      rows.push({
        key,
        productId: p.id,
        variant,
        name: p.name,
        size: sizeLabel(p, variant),
        price: old ? old.price : unitPrice(p, variant),
        max: p.inStock ? 999 : old.qty,
        old: Boolean(old),
      })
    }
  }
  // A product taken off the catalogue can stay on the order (or shrink), never grow.
  for (const l of order.lines) {
    const key = keyOf(l.productId, l.variant)
    if (!rows.some(r => r.key === key)) {
      rows.push({ key, productId: l.productId, variant: l.variant, name: l.name, size: l.size, price: l.price, max: l.qty, old: true })
    }
  }
  const current = rows.filter(r => r.old)
  const others = rows.filter(r => !r.old)

  const set = (row, n) => setQty(q => ({ ...q, [row.key]: Math.max(0, Math.min(row.max, n)) }))
  const chosen = rows.filter(r => (qty[r.key] || 0) > 0)
  const subtotal = chosen.reduce((t, r) => t + r.price * qty[r.key], 0)
  const total = subtotal + order.delivery
  const unchanged = chosen.length === order.lines.length
    && chosen.every(r => onOrder.has(r.key) && onOrder.get(r.key).qty === qty[r.key])
  // Compared with what has been paid (for a request) or the current total.
  const diff = Math.round((total - (request ? paid : order.total)) * 100) / 100

  const save = async () => {
    setError('')
    if (!chosen.length) {
      setError('Keep at least one item. To drop the whole order, cancel it instead.')
      return
    }
    setBusy(true)
    try {
      const items = chosen.map(r => ({ productId: r.productId, variant: r.variant, qty: qty[r.key] }))
      await (request ? requestOrderChange : editOrderItems)(order.id, items)
      onDone()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const line = row => (
    <div key={row.key} className="edit-row">
      <span className="grow min0">
        <span className="edit-name">{row.name}</span>
        <span className="muted-sm"> {row.size} &middot; {R(row.price)}</span>
        {row.max < 999 && <span className="muted-sm"> &middot; no more available</span>}
      </span>
      <Stepper
        small
        value={qty[row.key] || 0}
        onDec={() => set(row, (qty[row.key] || 0) - 1)}
        onInc={() => set(row, (qty[row.key] || 0) + 1)}
        label={row.name}
      />
    </div>
  )

  return (
    <section className="card card-pad stack gap-12">
      <div className="kicker muted">{request ? 'Request a change' : 'Change items'}</div>
      <div className="stack gap-8">{current.map(line)}</div>
      {others.length > 0 && (
        <details className="items-details">
          <summary>Add other products</summary>
          <div className="stack gap-8 mt-10">{others.map(line)}</div>
        </details>
      )}

      <div className="stack gap-6">
        <div className="sum-row"><span>New total (incl. delivery)</span><strong>{R(total)}</strong></div>
        {!unchanged && diff !== 0 && (
          <div className={'sum-row ' + (diff > 0 ? 'diff-up' : 'diff-down')}>
            <span>
              {request
                ? diff > 0 ? 'You will pay the difference' : 'Royal Tiara will refund you'
                : diff > 0 ? 'More than before' : 'Less than before'}
            </span>
            <strong>{R(Math.abs(diff))}</strong>
          </div>
        )}
        {request && <p className="hint mb-0">Royal Tiara approves the change first. Your order stays as it is until then.</p>}
      </div>

      {error && <p className="form-error mb-0" role="alert">{error}</p>}
      <div className="row gap-10">
        <button type="button" className="btn btn-primary btn-46 grow" disabled={busy || unchanged} onClick={save}>
          {busy ? 'Saving...' : request ? 'Send change request' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-outline btn-46 grow" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
