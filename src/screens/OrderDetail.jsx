import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { replaceCart } from '../lib/cart.js'
import { attachProof, cancelOrder, confirmReceipt, fetchOrders, switchToEft } from '../lib/db.js'
import { uploadProof } from '../lib/files.js'
import { useLive } from '../lib/live.js'
import { fmtDate, R } from '../lib/format.js'
import { orderState } from '../lib/orders.js'
import { goToPayfast } from '../lib/payfast.js'
import { BackButton, FilePicker, Loading } from '../components/ui.jsx'
import BankDetails, { Copyable } from '../components/BankDetails.jsx'

// PayFast confirms a card payment within seconds of the distributor coming
// back. If nothing has arrived this long after they open the order, the
// payment most likely failed and the options to pay again show.
const CONFIRM_WINDOW_MS = 30 * 1000
// Only an order placed this recently can still be waiting on PayFast.
const RECENT_ORDER_MS = 30 * 60 * 1000

export default function OrderDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: orders, loading, refresh } = useLive(fetchOrders, ['orders'], [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [askCancel, setAskCancel] = useState(false)
  // Coming from "Payment cancelled" we know the payment did not happen.
  const [params] = useSearchParams()
  const [showRetry, setShowRetry] = useState(params.get('retry') === '1')
  const [openedAt] = useState(() => Date.now())
  const [now, setNow] = useState(openedAt)
  const order = (orders || []).find(o => o.id === id)
  const recent = order && openedAt - new Date(order.createdAt).getTime() < RECENT_ORDER_MS
  const waitLeft = recent ? openedAt + CONFIRM_WINDOW_MS - now : 0

  // Re-check when the waiting window ends, so the page moves on by itself.
  useEffect(() => {
    if (waitLeft <= 0) return
    const timer = setTimeout(() => setNow(Date.now()), waitLeft + 500)
    return () => clearTimeout(timer)
  }, [waitLeft])

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>

  if (!order) return <Navigate to="/orders" replace />

  const st = orderState(order)
  // PayFast confirms a card payment a few seconds after the distributor comes
  // back. Until then, offering "Pay by card" again would invite paying twice.
  const confirming = st.byCard && !st.verified && !st.cancelled && !showRetry && waitLeft > 0

  const attach = async file => {
    setError('')
    try {
      const stored = await uploadProof(user.id, file)
      await attachProof(order.id, stored)
      refresh()
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const confirmArrived = async () => {
    setError('')
    setBusy(true)
    try {
      await confirmReceipt(order.id)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const payByCard = async () => {
    setError('')
    setBusy(true)
    try {
      await goToPayfast(order)   // leaves the app for PayFast
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const payByEft = async () => {
    setError('')
    setBusy(true)
    try {
      await switchToEft(order.id)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setError('')
    setBusy(true)
    try {
      await cancelOrder(order.id)
      setAskCancel(false)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const reorder = () => {
    replaceCart(user.id, order.lines.map(l => ({ productId: l.productId, variant: l.variant, qty: l.qty })))
    navigate('/cart')
  }

  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to="/orders" />
        <h2 className="title-sm">{order.id}</h2>
      </div>

      <div className="scroll px-22 pt-8 pb-18 stack gap-14">
        <section className="card-dark">
          <div className="kicker on-dark">Shipment</div>
          <div className="shipment-status">{st.status}</div>
          <div className="shipment-sub">{st.waybill}</div>
          <ol className="timeline">
            {st.steps.map(s => (
              <li key={s.label} className={s.done ? 'done' : ''}>
                <span className="tl-rail"><span className="tl-dot" /><span className="tl-line" /></span>
                <span className="tl-text">
                  <span className="tl-label">{s.label}</span>
                  <span className="tl-when">{s.when}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {order.trackingNumber && !st.cancelled && (
          <section className="card card-pad stack gap-8">
            <div className="kicker muted">Tracking</div>
            <div className="row between center gap-10 flex-wrap">
              <span className="body-muted">Your tracking number is</span>
              <Copyable value={order.trackingNumber} />
            </div>
            {order.courier && <div className="muted-sm">Courier: {order.courier}</div>}
          </section>
        )}

        {!st.hasProof && !st.verified && !st.cancelled && (
          <section className="card card-pad stack gap-12">
            <div className="kicker muted">Payment</div>
            <p className="body-muted">
              Pay {R(order.total)} by bank transfer using <strong>{order.id}</strong> as your reference, then upload your proof here.
            </p>
            <BankDetails amount={order.total} reference={order.id} />
            <FilePicker className="upload-box" onPicked={attach}>
              <span className="upload-title">Upload proof of payment</span>
              <span className="upload-sub">Photo or PDF</span>
            </FilePicker>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={payByCard}>
              {busy ? 'Opening PayFast...' : 'Pay by card instead'}
            </button>
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
        )}

        {confirming && (
          <section className="card card-pad stack gap-12">
            <div className="kicker muted">Payment</div>
            <div className="row center gap-10">
              <span className="spinner" aria-hidden="true" />
              <strong>Confirming your card payment...</strong>
            </div>
            <p className="body-muted mb-0">
              PayFast usually confirms within a few seconds. This page updates by itself, so there is no need to pay again.
            </p>
            <button type="button" className="link-inline link-btn retry-link" onClick={() => setShowRetry(true)}>
              Payment didn't go through?
            </button>
          </section>
        )}

        {st.byCard && !st.verified && !st.cancelled && !confirming && (
          <section className="card card-pad stack gap-12">
            <div className="kicker muted">Payment</div>
            <p className="body-muted">
              We have not received your card payment yet. If you have just paid, wait a minute before paying
              again - this page updates by itself as soon as PayFast confirms. If the payment was cancelled or did not go through, try again or pay by bank transfer.
            </p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={payByCard}>
              Pay {R(order.total)} by card
            </button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={payByEft}>
              {busy ? 'Switching...' : 'Pay by bank transfer instead'}
            </button>
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
        )}

        {st.cancelled && (
          <section className="card card-pad stack gap-10">
            <div className="kicker muted">Cancelled</div>
            <p className="body-muted mb-0">
              {order.events.cancelled_by === 'admin' ? 'Royal Tiara cancelled' : 'You cancelled'} this order on{' '}
              {fmtDate(order.events.cancelled)}. Nothing is owed. If you paid for it anyway, chat to Royal Tiara.
            </p>
          </section>
        )}

        {st.canCancel && !confirming && !askCancel && (
          <button type="button" className="link-inline link-btn retry-link cancel-link" onClick={() => setAskCancel(true)}>
            Cancel this order
          </button>
        )}

        {st.canCancel && !confirming && askCancel && (
          <section className="card card-pad stack gap-10" role="alertdialog" aria-label="Cancel this order?">
            <strong>Cancel order {order.id}?</strong>
            <p className="body-muted mb-0">Nothing has been paid, so nothing is owed. This cannot be undone.</p>
            {error && <p className="form-error mb-0" role="alert">{error}</p>}
            <div className="row gap-10">
              <button type="button" className="btn btn-danger btn-46 grow" disabled={busy} onClick={cancel}>
                {busy ? 'Cancelling...' : 'Yes, cancel it'}
              </button>
              <button type="button" className="btn btn-outline btn-46 grow" disabled={busy} onClick={() => setAskCancel(false)}>
                Keep it
              </button>
            </div>
          </section>
        )}

        {st.collected && !st.delivered && (
          <section className="card card-pad stack gap-10">
            <div className="kicker muted">Has it arrived?</div>
            <p className="body-muted">Let Royal Tiara know once your parcel reaches you.</p>
            <button type="button" className="btn btn-sage" disabled={busy} onClick={confirmArrived}>
              {busy ? 'Confirming...' : "I've received my order"}
            </button>
          </section>
        )}

        {st.delivered && (
          <section className="delivered-note">
            <span className="check-sm">&#10003;</span>
            <span className="grow">Delivered - thank you for your order.</span>
          </section>
        )}

        <section className="card card-pad stack gap-6">
          <div className="kicker muted">Deliver to</div>
          <div className="addr-name">
            {order.deliverTo === 'other' ? order.recipientName : order.business || order.customer}
          </div>
          {order.deliverTo === 'other' && <div className="muted-sm">{order.recipientPhone}</div>}
          <div className="addr-lines">
            {order.address.line1}
            {order.address.line2 && <><br />{order.address.line2}</>}
          </div>
        </section>

        <section className="card card-pad stack gap-11">
          <div className="kicker muted">Items</div>
          {order.lines.map(l => (
            <div key={l.productId + '-' + l.variant} className="item-line">
              <span className="grow">{l.name} <span className="muted-sm">{l.size}</span></span>
              <span className="muted">&times;{l.qty}</span>
              <strong className="item-amt">{R(l.total)}</strong>
            </div>
          ))}
          <div className="item-line">
            <span className="grow muted">Delivery Fee</span>
            <strong className="item-amt">{R(order.delivery)}</strong>
          </div>
          <div className="divider" />
          <div className="sum-total"><span className="h-17">Total</span><span className="sum-mid">{R(order.total)}</span></div>
        </section>

        <div className="row gap-10">
          {st.delivered || st.cancelled ? (
            <button type="button" className="btn btn-primary btn-52 grow" onClick={reorder}>
              {st.cancelled ? 'Order again' : 'Reorder'}
            </button>
          ) : (
            // Still on its way: reordering makes no sense yet, so offer the way back.
            <Link to="/home" className="btn btn-primary btn-52 grow">Back to home</Link>
          )}
          <Link to={'/invoices/' + order.id} className="btn btn-outline btn-52 grow">Invoice</Link>
        </div>
      </div>
    </div>
  )
}
