import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { clearCart, useCart } from '../lib/cart.js'
import { DELIVERY_FEE, fetchActiveProducts, fetchFees, placeOrder } from '../lib/db.js'
import { goToPayfast, isPayfastSandbox } from '../lib/payfast.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { BackButton, Loading, Segmented } from '../components/ui.jsx'
import { useDeliveryForm } from '../components/DeliveryForm.jsx'

export default function Checkout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: products, loading } = useLive(fetchActiveProducts, ['products'], [])
  const { data: fees } = useLive(fetchFees, ['settings'], [])
  const cart = useCart(user.id, products, fees ? fees.delivery : DELIVERY_FEE)
  const placed = useRef(false)
  const [method, setMethod] = useState('eft')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const delivery = useDeliveryForm(user)

  // Money Royal Tiara owes this distributor comes off the order automatically.
  const credit = Math.min(user.credit || 0, cart.total)
  const due = Math.round((cart.total - credit) * 100) / 100

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>
  if (!cart.lines.length && !placed.current) return <Navigate to="/cart" replace />

  const first = cart.lines[0] ? cart.lines[0].product.name : ''
  const itemsLabel = cart.lines.length > 1 ? first + ' + ' + (cart.lines.length - 1) + ' more' : first

  const place = async () => {
    setError('')
    const { deliver, problem } = delivery.build()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    try {
      const order = await placeOrder(cart.items, method, null, deliver)
      placed.current = true
      clearCart(user.id)
      if (method === 'card' && order.payStatus !== 'verified') {
        try {
          await goToPayfast(order)   // leaves the app for PayFast
        } catch {
          // The order is saved: its page offers to pay again or switch to bank transfer.
          navigate('/orders/' + order.id + '?retry=1', { replace: true })
        }
        return
      }
      navigate('/success/' + order.id, { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to="/cart" />
        <h2 className="title-sm">Checkout</h2>
      </div>

      <div className="scroll px-22 pt-8 pb-16 stack gap-14">
        <section className="card card-pad stack gap-12">
          <div className="kicker muted">Deliver to</div>
          {delivery.form}
        </section>

        {due > 0 ? <section className="card card-pad stack gap-14">
          <div className="kicker muted">Payment method</div>
          <Segmented
            value={method}
            onChange={setMethod}
            options={[{ value: 'eft', label: 'Bank transfer' }, { value: 'card', label: 'Card' }]}
          />

          {method === 'eft' && (
            <p className="hint mb-0">
              You'll get Royal Tiara's bank details and your payment reference as soon as you place the order.
            </p>
          )}

          {method === 'card' && (
            <div className="payfast-note">
              <span className="payfast-badge">Pay<span>Fast</span></span>
              <span className="grow">
                You will be taken to PayFast's secure page to pay, then brought straight back.
                {isPayfastSandbox && (
                  <em className="demo-note">Test mode - use PayFast's test card, no real money moves.</em>
                )}
              </span>
            </div>
          )}
        </section> : (
          <section className="card card-pad">
            <p className="body-muted mb-0">The amount payable to you covers this whole order, so there is nothing to pay.</p>
          </section>
        )}

        <section className="summary">
          <div className="sum-row"><span className="ellipsis">{itemsLabel}</span><strong>{R(cart.subtotal)}</strong></div>
          <div className="sum-row"><span>Delivery Fee</span><strong>{R(cart.delivery)}</strong></div>
          {credit > 0 && (
            <div className="sum-row credit-row"><span>Amount payable to you</span><strong>-{R(credit)}</strong></div>
          )}
          <div className="divider" />
          <div className="sum-total"><span>Due</span><span className="sum-big">{R(due)}</span></div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      <div className="bottom-bar">
        <button type="button" className="btn btn-primary" onClick={place} disabled={busy}>
          {busy
            ? 'Placing order...'
            : method === 'card' && due > 0
              ? 'Pay ' + R(due) + ' with card'
              : 'Place order'}
        </button>
      </div>
    </div>
  )
}
