import { useState } from 'react'
import { adminAdvanceOrder, cancelOrder, fetchOrders } from '../../lib/db.js'
import { openProof } from '../../lib/files.js'
import { useLive } from '../../lib/live.js'
import { fmtDate, R } from '../../lib/format.js'
import { orderState, unitsIn } from '../../lib/orders.js'
import { ErrorNote, Loading } from '../../components/ui.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'
import BankDetailsForm from './BankDetailsForm.jsx'
import Fees from './Fees.jsx'

export default function Sales() {
  const { data, loading, error, refresh } = useLive(fetchOrders, ['orders'], [])
  const [problem, setProblem] = useState('')

  const all = data || []
  // Cancelled orders are kept for the record but out of the way, at the bottom.
  const orders = all.filter(o => o.fulfil !== 'cancelled')
  const cancelled = all.filter(o => o.fulfil === 'cancelled')
  const toVerify = orders.filter(o => o.proof && o.payStatus !== 'verified').length

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
      <BankDetailsForm />

      {loading && <Loading label="Loading sales..." />}
      <ErrorNote message={error} onRetry={refresh} />
      {problem && <p className="form-error" role="alert">{problem}</p>}

      {!loading && orders.length === 0 && (
        <div className="empty-card empty-sm">No sales yet. Distributor orders appear here.</div>
      )}

      {orders.map(o => (
        <SaleCard key={o.id} order={o} onDone={refresh} onProblem={setProblem} />
      ))}

      {cancelled.length > 0 && (
        <details className="items-details">
          <summary>Cancelled orders &middot; {cancelled.length}</summary>
          <div className="stack gap-12 mt-10">
            {cancelled.map(o => (
              <SaleCard key={o.id} order={o} onDone={refresh} onProblem={setProblem} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function SaleCard({ order, onDone, onProblem }) {
  const [busy, setBusy] = useState(false)
  const [ask, dialog] = useConfirm()
  const st = orderState(order, 'admin')

  const pay = st.cancelled
    ? { label: st.waybill, cls: 'pay-waiting' }
    : st.verified
      ? { label: order.payMethod === 'card' ? 'Card payment confirmed' : 'Payment verified', cls: 'pay-ok' }
      : order.proof
        ? { label: 'Proof received - verify', cls: 'pay-review' }
        : order.payMethod === 'card'
          ? { label: 'Card payment not received yet', cls: 'pay-waiting' }
          : { label: 'Awaiting proof of payment', cls: 'pay-waiting' }

  const advance = async step => {
    if (step === 'delivered') {
      const ok = await ask({
        title: 'Mark ' + order.id + ' as delivered?',
        body: 'Only do this if the distributor told you it arrived.',
        yes: 'Mark delivered',
      })
      if (!ok) return
    }
    if (step === 'verify' && !order.proof) {
      const ok = await ask({
        title: 'Verify ' + order.id + ' without a proof?',
        body: 'No proof was uploaded. Only verify if ' + R(order.total) + ' has reflected in the Royal Tiara account.',
        yes: 'It has reflected - verify',
      })
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

  const cancel = async () => {
    const ok = await ask({
      title: 'Cancel ' + order.id + '?',
      body: (order.business || order.customer) + ' is told it was cancelled. If the money arrives later, verifying it brings the order back.',
      yes: 'Cancel order',
      no: 'Keep it',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    onProblem('')
    try {
      await cancelOrder(order.id)
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
      {dialog}
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
          {st.cancelled ? 'Payment arrived - verify and restore' : 'Verify payment'}
        </button>
      )}
      {st.canCancel && (
        <button type="button" className="btn btn-outline btn-44" disabled={busy} onClick={cancel}>
          Cancel order
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
