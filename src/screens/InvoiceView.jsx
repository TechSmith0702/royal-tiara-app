import { Navigate, useParams } from 'react-router-dom'
import { fetchOrders } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { fmtDate, R, WHATSAPP_DISPLAY } from '../lib/format.js'
import { orderState } from '../lib/orders.js'
import { isNativeApp } from '../lib/platform.js'
import { BackButton, Loading } from '../components/ui.jsx'
import BankDetails from '../components/BankDetails.jsx'

export default function InvoiceView() {
  const { id } = useParams()
  const { data: orders, loading } = useLive(fetchOrders, ['orders'], [])

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>

  const order = (orders || []).find(o => o.id === id)
  if (!order) return <Navigate to="/invoices" replace />

  const st = orderState(order)

  return (
    <div className="screen">
      <div className="page-top row between center no-print">
        <BackButton to="/invoices" />
        {/* Android's in-app browser has no print dialog, so the button would do nothing there. */}
        {!isNativeApp && (
          <button type="button" className="btn btn-dark btn-sm btn-inline" onClick={() => window.print()}>
            Save as PDF / Print
          </button>
        )}
      </div>

      <div className="scroll px-22 pb-24">
        <article className="invoice-doc">
          <header className="row between start gap-12">
            <div className="stack gap-6 min0">
              <img className="inv-logo" src="/logo.webp" alt="Royal Tiara" width="640" height="351" />
              <div className="muted-sm">Where beauty begins within &middot; WhatsApp {WHATSAPP_DISPLAY}</div>
            </div>
            <div className="right">
              <div className="kicker muted">Invoice</div>
              <div className="inv-no">{order.invoice}</div>
              <div className="muted-sm">{fmtDate(order.createdAt)}</div>
            </div>
          </header>

          <div className="inv-grid">
            <div>
              <div className="kicker muted">Bill to</div>
              <div className="inv-strong">{order.business || order.customer}</div>
              <div className="muted-sm">{order.customer}</div>
              <div className="muted-sm">{order.address.line1}</div>
              <div className="muted-sm">{order.address.line2}</div>
            </div>
            <div className="right">
              <div className="kicker muted">Order</div>
              <div className="inv-strong">{order.id}</div>
              <div className="muted-sm">{order.payMethod === 'card' ? 'Card (PayFast)' : 'Bank transfer (EFT)'}</div>
              <div className="muted-sm">Status: {st.invoice.label}</div>
            </div>
          </div>

          <table className="inv-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="right">Qty</th>
                <th className="right">Price</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map(l => (
                <tr key={l.productId + '-' + l.variant}>
                  <td>{l.name}<div className="muted-sm">{l.size}</div></td>
                  <td className="right">{l.qty}</td>
                  <td className="right">{R(l.price)}</td>
                  <td className="right">{R(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="inv-totals">
            <div className="sum-row"><span>Subtotal</span><strong>{R(order.subtotal)}</strong></div>
            <div className="sum-row"><span>Delivery Fee</span><strong>{R(order.delivery)}</strong></div>
            <div className="divider" />
            <div className="sum-total"><span className="h-17">Total</span><span className="sum-mid">{R(order.total)}</span></div>
          </div>

          {order.payMethod === 'eft' && !st.verified && !st.cancelled && (
            <div className="stack gap-8">
              <div className="kicker muted">Payment details</div>
              <BankDetails amount={order.total} reference={order.id} />
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
