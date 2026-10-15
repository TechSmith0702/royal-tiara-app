import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { clearCart, useCart } from '../lib/cart.js'
import { DELIVERY_FEE, fetchActiveProducts, fetchFees, placeOrder } from '../lib/db.js'
import { uploadProof } from '../lib/files.js'
import { goToPayfast, isPayfastSandbox } from '../lib/payfast.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import AddressCard from '../components/AddressCard.jsx'
import BankDetails from '../components/BankDetails.jsx'
import { BackButton, FilePicker, Loading, Segmented } from '../components/ui.jsx'

export default function Checkout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: products, loading } = useLive(fetchActiveProducts, ['products'], [])
  const { data: fees } = useLive(fetchFees, ['settings'], [])
  const cart = useCart(user.id, products, fees ? fees.delivery : DELIVERY_FEE)
  const placed = useRef(false)
  const [method, setMethod] = useState('eft')
  const [proof, setProof] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>
  if (!cart.lines.length && !placed.current) return <Navigate to="/cart" replace />

  const first = cart.lines[0] ? cart.lines[0].product.name : ''
  const itemsLabel = cart.lines.length > 1 ? first + ' + ' + (cart.lines.length - 1) + ' more' : first

  const attach = async file => {
    const stored = await uploadProof(user.id, file)
    setProof(stored)
  }

  const place = async () => {
    setError('')
    setBusy(true)
    try {
      const order = await placeOrder(cart.items, method, method === 'eft' ? proof : null)
      placed.current = true
      clearCart(user.id)
      if (method === 'card') {
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
        <AddressCard user={user} />

        <section className="card card-pad stack gap-14">
          <div className="kicker muted">Payment method</div>
          <Segmented
            value={method}
            onChange={setMethod}
            options={[{ value: 'eft', label: 'Bank transfer' }, { value: 'card', label: 'Card' }]}
          />

          {method === 'eft' && <BankDetails amount={cart.total} />}
          {method === 'eft' && (
            <p className="hint mb-0">You will see your order number, your payment reference, once you place the order.</p>
          )}

          {method === 'eft' ? (
            proof ? (
              <div className="proof-ok">
                <span className="check-sm">&#10003;</span>
                <div className="grow min0">
                  <div className="proof-ok-name">{proof.name}</div>
                  <div className="proof-ok-sub">Attached &middot; Royal Tiara verifies once it reflects</div>
                </div>
                <button type="button" className="text-btn" onClick={() => setProof(null)}>Remove</button>
              </div>
            ) : (
              <FilePicker className="upload-box" onPicked={attach}>
                <span className="upload-title">Upload proof of payment</span>
                <span className="upload-sub">Photo or PDF &middot; you can also add it later</span>
              </FilePicker>
            )
          ) : (
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
        </section>

        <section className="summary">
          <div className="sum-row"><span className="ellipsis">{itemsLabel}</span><strong>{R(cart.subtotal)}</strong></div>
          <div className="sum-row"><span>Delivery Fee</span><strong>{R(cart.delivery)}</strong></div>
          <div className="divider" />
          <div className="sum-total"><span>Due</span><span className="sum-big">{R(cart.total)}</span></div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      <div className="bottom-bar">
        <button type="button" className="btn btn-primary" onClick={place} disabled={busy}>
          {busy
            ? 'Placing order...'
            : method === 'card'
              ? 'Pay ' + R(cart.total) + ' with card'
              : 'Place order'}
        </button>
      </div>
    </div>
  )
}
