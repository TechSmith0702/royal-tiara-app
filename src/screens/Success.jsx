import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { cancelOrder, fetchOrders } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { orderState } from '../lib/orders.js'
import { Loading } from '../components/ui.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'

export default function Success() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: orders, loading } = useLive(fetchOrders, ['orders'], [])
  const [ask, dialog] = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>

  const order = (orders || []).find(o => o.id === id)
  if (!order) return <Navigate to="/orders" replace />

  // A bank transfer still to be paid: the next step is paying it (on the
  // order page), or cancelling the order. No "keep shopping" until then.
  const awaitingTransfer = order.payMethod === 'eft' && !order.proof && order.payStatus !== 'verified'
  const st = orderState(order)

  const note = order.payMethod === 'card'
    ? 'Royal Tiara will confirm your card payment and start packing.'
    : order.proof
      ? 'Your proof of payment is with us - we will confirm as soon as it reflects.'
      : 'Tap View Order to see the banking details and upload your proof of payment.'

  const cancel = async () => {
    const ok = await ask({
      title: 'Cancel order ' + order.id + '?',
      body: 'Nothing has been paid, so nothing is owed. This cannot be undone.',
      yes: 'Yes, cancel it',
      no: 'Keep it',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await cancelOrder(order.id)
      navigate('/orders/' + order.id, { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen screen-dark">
      {dialog}
      <div className="success-body">
        <div className="check-big">&#10003;</div>
        <div>
          <h2 className="success-title">Order placed</h2>
          <p className="success-lede">Order {order.id} &middot; {R(order.total)}. {note}</p>
        </div>
        <div className="invoice-strip">
          <span>Invoice</span><strong>{order.invoice} &middot; issued</strong>
        </div>
      </div>
      <div className="stack gap-10">
        {error && <p className="form-error mb-0" role="alert">{error}</p>}
        <Link to={'/orders/' + order.id} className="btn btn-primary" replace>
          View Order
        </Link>
        {awaitingTransfer && st.canCancel ? (
          <button type="button" className="btn btn-ghost-light" disabled={busy} onClick={cancel}>
            {busy ? 'Cancelling...' : 'Cancel order'}
          </button>
        ) : (
          <Link to="/shop" className="btn btn-ghost-light" replace>Keep shopping</Link>
        )}
      </div>
    </div>
  )
}
