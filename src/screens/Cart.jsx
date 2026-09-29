import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { changeCartQty, useCart } from '../lib/cart.js'
import { fetchActiveProducts } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { BackButton, Loading, ProductImage, Stepper } from '../components/ui.jsx'

export default function Cart() {
  const { user } = useAuth()
  const { data: products, loading } = useLive(fetchActiveProducts, ['products'], [])
  const cart = useCart(user.id, products)
  const empty = !loading && cart.lines.length === 0

  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to="/shop" />
        <h2 className="title-sm">Your order</h2>
      </div>

      <div className="scroll list pt-8">
        {loading && <Loading />}

        {empty && (
          <div className="empty-card">
            <h3 className="h3-sm">Nothing in the cart yet</h3>
            <p>Your distributor pricing is applied on every line.</p>
            <Link to="/shop" className="btn btn-primary btn-md btn-inline">Browse catalogue</Link>
          </div>
        )}

        {cart.lines.map(l => (
          <div key={l.productId + '-' + l.variant} className="cart-row">
            <ProductImage product={l.product} className="cart-img" initialSize={20} />
            <div className="grow min0">
              <div className="cart-name">{l.product.name}</div>
              <div className="row-sub">{l.size} &middot; {R(l.price)} each</div>
              {!l.product.inStock && <div className="oos-inline block">Out of stock - remove to check out</div>}
              <div className="row-price">{R(l.total)}</div>
            </div>
            <Stepper
              small
              value={l.qty}
              label={l.product.name}
              onDec={() => changeCartQty(user.id, l.index, -1)}
              onInc={() => changeCartQty(user.id, l.index, 1)}
            />
          </div>
        ))}

        {cart.lines.length > 0 && (
          <div className="summary mt-4">
            <div className="sum-row"><span>Subtotal</span><strong>{R(cart.subtotal)}</strong></div>
            <div className="sum-row"><span>Delivery Fee</span><strong>{R(cart.delivery)}</strong></div>
            <div className="divider" />
            <div className="sum-total"><span>Total</span><span className="sum-big">{R(cart.total)}</span></div>
          </div>
        )}
      </div>

      {cart.lines.length > 0 && (
        <div className="bottom-bar">
          {cart.hasOutOfStock
            ? <button type="button" className="btn btn-primary" disabled>Remove out-of-stock items</button>
            : <Link to="/checkout" className="btn btn-primary">Checkout</Link>}
        </div>
      )}
    </div>
  )
}
