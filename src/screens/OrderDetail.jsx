import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { replaceCart } from '../lib/cart.js'
import { attachProof, confirmReceipt, fetchOrders, switchToEft } from '../lib/db.js'
import { uploadProof } from '../lib/files.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { orderState } from '../lib/orders.js'
import { goToPayfast, isPayfastConfigured } from '../lib/payfast.js'
import { BackButton, FilePicker, Loading } from '../components/ui.jsx'

// PayFast confirms a card payment within seconds. If nothing has arrived after
// this long, the payment most likely failed and the options to pay again show.
const CONFIRM_WINDOW_MS = 5 * 60 * 1000

export default function OrderDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: orders, loading, refresh } = useLive(fetchOrders, ['orders'], [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Coming from "Payment cancelled" we know the payment did not happen.
  const [params] = useSearchParams()
  const [showRetry, setShowRetry] = useState(params.get('retry') === '1')
  const [now, setNow] = useState(() => Date.now())
  const order = (orders || []).find(o => o.id === id)
  const waitLeft = order ? new Date(order.createdAt).getTime() + CONFIRM_WINDOW_MS - now : 0

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
  const confirming = st.byCard && !st.verified && !showRetry && waitLeft > 0

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

  const payByCard = () => {
    setError('')
    try {
      goToPayfast(order, user)   // leaves the app for PayFast
    } catch (e) {
      setError(e.message)
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

        {!st.hasProof && (
          <section className="card card-pad stack gap-12">
            <div className="kicker muted">Payment</div>
            <p className="body-muted">
              Pay {R(order.total)} by bank transfer using <strong>{order.id}</strong> as your reference, then upload your proof here.
            </p>
            <FilePicker className="upload-box" onPicked={attach}>
              <span className="upload-title">Upload proof of payment</span>
              <span className="upload-sub">Photo or PDF</span>
            </FilePicker>
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
              PayFast usually confirms within a minute. This page updates by itself, so there is no need to pay again.
            </p>
            <button type="button" className="link-inline link-btn retry-link" onClick={() => setShowRetry(true)}>
              Payment didn't go through?
            </button>
          </section>
        )}

        {st.byCard && !st.verified && !confirming && (
          <section className="card card-pad stack gap-12">
            <div className="kicker muted">Payment</div>
            <p className="body-muted">
              We have not received your card payment yet. If you have just paid, this updates by itself in a
              few minutes. If the payment was cancelled or did not go through, try again or pay by bank transfer.
            </p>
            {isPayfastConfigured && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={payByCard}>
                Pay {R(order.total)} by card
              </button>
            )}
            <button type="button" className="btn btn-outline" disabled={busy} onClick={payByEft}>
              {busy ? 'Switching...' : 'Pay by bank transfer instead'}
            </button>
            {error && <p className="form-error" role="alert">{error}</p>}
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
          {st.delivered ? (
            <button type="button" className="btn btn-primary btn-52 grow" onClick={reorder}>Reorder</button>
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
