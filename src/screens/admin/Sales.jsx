import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminAdvanceOrder, cancelOrder, fetchApplications, fetchOrders } from '../../lib/db.js'
import { openProof } from '../../lib/files.js'
import { useLive } from '../../lib/live.js'
import { fmtDate, R, waLinkTo } from '../../lib/format.js'
import { orderState, unitsIn } from '../../lib/orders.js'
import { ErrorNote, Loading } from '../../components/ui.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'

// Which list an order belongs in. "Active" is everything still needing work.
const FILTERS = [
  { value: 'active', label: 'Active', test: o => o.fulfil !== 'delivered' && o.fulfil !== 'cancelled' },
  { value: 'verify', label: 'To verify', test: o => o.payStatus !== 'verified' && !!o.proof && o.fulfil !== 'cancelled' },
  { value: 'pack', label: 'To pack', test: o => o.payStatus === 'verified' && !o.fulfil },
  { value: 'unpaid', label: 'Awaiting payment', test: o => o.payStatus !== 'verified' && !o.proof && o.fulfil !== 'cancelled' },
  { value: 'transit', label: 'Packed & on the way', test: o => o.fulfil === 'packed' || o.fulfil === 'collected' },
  { value: 'delivered', label: 'Delivered', test: o => o.fulfil === 'delivered' },
  { value: 'cancelled', label: 'Cancelled', test: o => o.fulfil === 'cancelled' },
]

export default function Sales() {
  const { data, loading, error, refresh } = useLive(fetchOrders, ['orders'], [])
  const { data: people } = useLive(fetchApplications, ['profiles'], [])
  const [problem, setProblem] = useState('')
  const [filter, setFilter] = useState('active')
  const [query, setQuery] = useState('')

  const all = data || []
  const count = value => all.filter(FILTERS.find(f => f.value === value).test).length
  const now = new Date()
  const thisMonth = all
    .filter(o => {
      const d = new Date(o.createdAt)
      return o.payStatus === 'verified' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((t, o) => t + o.total, 0)

  // The courier needs a phone number, which lives on the distributor's profile.
  const phones = new Map((people || []).map(p => [p.id, p.phone]))

  const q = query.trim().toLowerCase()
  const shown = all
    .filter(FILTERS.find(f => f.value === filter).test)
    .filter(o => !q || (o.id + ' ' + o.invoice + ' ' + o.customer + ' ' + (o.business || '')).toLowerCase().includes(q))

  return (
    <div className="stack gap-16">
      <div className="row gap-10">
        <button type="button" className="stat stat-sage grow stat-btn" onClick={() => setFilter('verify')}>
          <div className="kicker">To verify</div>
          <div className="stat-value">{count('verify')}</div>
          <div className="stat-sub">payments</div>
        </button>
        <button type="button" className="stat stat-peach grow stat-btn" onClick={() => setFilter('pack')}>
          <div className="kicker">To pack</div>
          <div className="stat-value">{count('pack')}</div>
          <div className="stat-sub">paid orders</div>
        </button>
      </div>
      <div className="stat stat-plain">
        <div className="kicker muted">Paid this month</div>
        <div className="stat-value">{R(thisMonth)}</div>
      </div>

      <Link to="/admin/settings" className="settings-link">
        <span className="grow">Fees, monthly minimum &amp; bank details</span>
        <span className="chev">&rsaquo;</span>
      </Link>

      <input
        className="field field-search"
        type="search"
        placeholder="Search order number or name"
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Search orders"
      />

      <div className="chips" role="tablist" aria-label="Show orders">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={'chip' + (filter === f.value ? ' chip-on' : '')}
            onClick={() => setFilter(f.value)}
          >
            {f.label} <span className="chip-count">{count(f.value)}</span>
          </button>
        ))}
      </div>

      {loading && <Loading label="Loading sales..." />}
      <ErrorNote message={error} onRetry={refresh} />
      {problem && <p className="form-error" role="alert">{problem}</p>}

      {!loading && shown.length === 0 && (
        <div className="empty-card empty-sm">
          {all.length === 0
            ? 'No sales yet. Distributor orders appear here.'
            : q ? 'No orders match "' + query.trim() + '".' : 'Nothing here right now.'}
        </div>
      )}

      {shown.map(o => (
        <SaleCard key={o.id} order={o} phone={phones.get(o.userId)} onDone={refresh} onProblem={setProblem} />
      ))}
    </div>
  )
}

function SaleCard({ order, phone, onDone, onProblem }) {
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
            {phone && (
              <div className="muted-sm">
                <a className="link-inline" href={'tel:' + phone.replace(/\s/g, '')}>{phone}</a>
                {' · '}
                <a className="link-inline" href={waLinkTo(phone, 'Hi, this is Royal Tiara about order ' + order.id + '.')} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </div>
            )}
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
