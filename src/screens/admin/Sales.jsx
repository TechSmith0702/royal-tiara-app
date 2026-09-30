import { useState } from 'react'
import { adminAdvanceOrder, fetchOrders } from '../../lib/db.js'
import { openProof } from '../../lib/files.js'
import { useLive } from '../../lib/live.js'
import { fmtDate, R } from '../../lib/format.js'
import { orderState, unitsIn } from '../../lib/orders.js'
import { ErrorNote, Loading } from '../../components/ui.jsx'
import Fees from './Fees.jsx'

export default function Sales() {
  const { data, loading, error, refresh } = useLive(fetchOrders, ['orders'], [])
  const [problem, setProblem] = useState('')

  const orders = data || []
  const toVerify = orders.filter(o => orderState(o).hasProof && o.payStatus !== 'verified').length

  return (
    <div className="stack gap-18">
      <div className="row gap-12">
        <div className="stat stat-outline grow">
          <div className="kicker">Orders</div>
          <div className="stat-value">{orders.length}</div>
          <div className="stat-sub">placed</div>
        </div>
        <div className="stat stat-sage grow">
          <div className="kicker">Payments</div>
          <div className="stat-value">{toVerify}</div>
          <div className="stat-sub">to verify</div>
        </div>
      </div>

      <Fees />

      {loading && <Loading label="Loading sales..." />}
      <ErrorNote message={error} onRetry={refresh} />
      {problem && <p className="form-error" role="alert">{problem}</p>}

      {!loading && orders.length === 0 && (
        <div className="empty-card empty-sm">No sales yet. Distributor orders appear here.</div>
      )}

      {orders.map(o => (
        <SaleCard key={o.id} order={o} onDone={refresh} onProblem={setProblem} />
      ))}
    </div>
  )
}

function SaleCard({ order, onDone, onProblem }) {
  const [busy, setBusy] = useState(false)
  const st = orderState(order, 'admin')

  const pay = st.verified
    ? { label: order.payMethod === 'card' ? 'Card payment confirmed' : 'Payment verified', cls: 'pay-ok' }
    : order.proof
      ? { label: 'Proof received - verify', cls: 'pay-review' }
      : order.payMethod === 'card'
        ? { label: 'Card payment - confirm before packing', cls: 'pay-review' }
        : { label: 'Awaiting proof of payment', cls: 'pay-waiting' }

  const advance = async step => {
    if (step === 'delivered') {
      const ok = confirm('Mark ' + order.id + ' as delivered? Only do this if the distributor told you it arrived.')
      if (!ok) return
    }
    if (step === 'verify' && !order.proof) {
      const ok = confirm(
        'No proof uploaded for ' + order.id + '. Only verify if ' + R(order.total) + ' has reflected in the Royal Tiara account.',
      )
      if (!ok) return
    }
    setBusy(true)
    onProblem('')
    try {
      await adminAdvanceOrder(order.id, step)
      onDone()
    } catch (e) {
      onProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  const view = async () => {
    onProblem('')
    try {
      await openProof(order.proof.path)
    } catch (e) {
      onProblem(e.message)
    }
  }

  return (
    <div className="card card-pad-lg stack gap-15">
      <div className="row between start gap-10">
        <div className="min0">
          <div className="sale-id">{order.id} &middot; {order.business || order.customer}</div>
          <div className="row-sub">{fmtDate(order.createdAt)}</div>
        </div>
        <span className="sale-total">{R(order.total)}</span>
      </div>

      <div className="pay-row">
        <span className="method-badge">{order.payMethod === 'card' ? 'CARD' : 'EFT'}</span>
        <span className={'pay-label ' + pay.cls}>{pay.label}</span>
      </div>

      <details className="items-details">
        <summary>Items to pack &middot; {unitsIn(order)} units</summary>
        <div className="stack gap-6 mt-10">
          {order.lines.map(l => (
            <div key={l.productId + '-' + l.variant} className="item-line">
              <span className="grow">{l.name} <span className="muted-sm">{l.size}</span></span>
              <strong>&times;{l.qty}</strong>
            </div>
          ))}
          <div className="deliver-to">
            <span className="kicker muted">Deliver to</span>
            <div>{order.business || order.customer}</div>
            <div className="muted-sm">
              {order.address.line1}{order.address.line2 ? ', ' + order.address.line2 : ''}
            </div>
          </div>
        </div>
      </details>

      {order.proof && (
        <button type="button" className="btn btn-outline btn-44" onClick={view}>View proof of payment</button>
      )}
      {!st.verified && (
        <button type="button" className="btn btn-sage btn-46" disabled={busy} onClick={() => advance('verify')}>
          Verify payment
        </button>
      )}
      {st.verified && !st.packed && (
        <button type="button" className="btn btn-primary btn-46" disabled={busy} onClick={() => advance('packed')}>
          Mark packed &amp; ready
        </button>
      )}
      {st.packed && !st.collected && (
        <button type="button" className="btn btn-dark btn-46" disabled={busy} onClick={() => advance('collected')}>
          Mark collected by courier
        </button>
      )}
      {st.collected && !st.delivered && (
        <>
          <div className="done-pill">&#10003; Collected - in transit to client</div>
          <button type="button" className="btn btn-outline btn-44" disabled={busy} onClick={() => advance('delivered')}>
            Client told me it arrived
          </button>
        </>
      )}
      {st.delivered && <div className="done-pill done-pill-sage">&#10003; Delivered</div>}

      <div className="track">
        <div className="kicker faint">Tracking to client</div>
        {st.steps.map(s => (
          <div key={s.label} className={'track-step ' + (s.done ? 'done' : '')}>
            <span className="track-dot" />
            <span className="track-label">{s.label}</span>
            <span className="track-meta">{s.when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
