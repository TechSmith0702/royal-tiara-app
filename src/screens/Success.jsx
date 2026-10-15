import { Link, Navigate, useParams } from 'react-router-dom'
import { fetchOrders } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { Loading } from '../components/ui.jsx'

export default function Success() {
  const { id } = useParams()
  const { data: orders, loading } = useLive(fetchOrders, ['orders'], [])

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>

  const order = (orders || []).find(o => o.id === id)
  if (!order) return <Navigate to="/orders" replace />

  const note = order.payMethod === 'card'
    ? 'Royal Tiara will confirm your card payment and start packing.'
    : order.proof
      ? 'Your proof of payment is with us - we will confirm as soon as it reflects.'
      : 'Pay by bank transfer using ' + order.id + ' as the reference, then upload your proof of payment. The bank details are on the order page.'

  return (
    <div className="screen screen-dark">
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
        <Link to={'/orders/' + order.id} className="btn btn-primary" replace>
          {order.payMethod === 'eft' && !order.proof ? 'See bank details' : 'Track this order'}
        </Link>
        <Link to="/shop" className="btn btn-ghost-light" replace>Keep shopping</Link>
      </div>
    </div>
  )
}
