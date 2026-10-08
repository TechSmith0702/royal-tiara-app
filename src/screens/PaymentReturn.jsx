import { Link, useParams, useSearchParams } from 'react-router-dom'
import { isPayfastSandbox } from '../lib/payfast.js'

/**
 * Where PayFast sends the distributor back to. PayFast confirms the payment
 * separately, server-to-server, so this page never marks anything paid.
 */
export default function PaymentReturn({ outcome }) {
  const [params] = useSearchParams()
  const { id } = useParams()
  const orderId = params.get('order') || id
  const cancelled = outcome === 'cancel'

  return (
    <div className={cancelled ? 'screen' : 'screen screen-dark'}>
      {cancelled ? (
        <div className="scroll page stack gap-18">
          <h2 className="title">Payment cancelled</h2>
          <p className="body-muted">
            Nothing was charged. Your order {orderId} is saved - you can pay by card again, or switch to bank
            transfer and upload a proof of payment.
          </p>
          <div className="stack gap-10">
            {orderId && <Link to={'/orders/' + orderId + '?retry=1'} className="btn btn-primary">Open the order</Link>}
            <Link to="/shop" className="btn btn-outline">Back to the shop</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="success-body">
            <div className="check-big">&#10003;</div>
            <div>
              <h2 className="success-title">Payment submitted</h2>
              <p className="success-lede">
                Thank you. Royal Tiara confirms your payment and then packs order {orderId}. You will get a
                notification at each step.
                {isPayfastSandbox && ' (Sandbox test - no real money moved.)'}
              </p>
            </div>
          </div>
          <div className="stack gap-10">
            {orderId && <Link to={'/orders/' + orderId} className="btn btn-primary" replace>Track this order</Link>}
            <Link to="/shop" className="btn btn-ghost-light" replace>Keep shopping</Link>
          </div>
        </>
      )}
    </div>
  )
}
