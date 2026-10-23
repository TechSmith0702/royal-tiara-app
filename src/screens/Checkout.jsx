import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { clearCart, useCart } from '../lib/cart.js'
import { DELIVERY_FEE, fetchActiveProducts, fetchFees, placeOrder } from '../lib/db.js'
import { uploadProof } from '../lib/files.js'
import { goToPayfast, isPayfastSandbox } from '../lib/payfast.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { BackButton, FilePicker, Loading, Segmented } from '../components/ui.jsx'

// Someone else receiving the order: the courier needs their name, number and address.
const PERSON_FIELDS = [
  { key: 'name', label: 'Their name', short: 'their name', autoComplete: 'off' },
  { key: 'phone', label: 'Their phone number', short: 'their phone number', type: 'tel', inputMode: 'tel', autoComplete: 'off' },
  { key: 'email', label: 'Their email (optional)', optional: true, type: 'email', inputMode: 'email', autoComplete: 'off' },
]
// To their door, by The Courier Guy.
const ADDRESS_FIELDS = [
  { key: 'line1', label: 'Street address', short: 'the street address', autoComplete: 'off' },
  { key: 'suburb', label: 'Suburb', short: 'the suburb', autoComplete: 'off' },
  { key: 'city', label: 'City / Town', short: 'the city or town', autoComplete: 'off' },
  { key: 'province', label: 'Province', short: 'the province', autoComplete: 'off' },
  { key: 'postal', label: 'Postal code', short: 'the postal code', inputMode: 'numeric', maxLength: 4, autoComplete: 'off' },
]
// Or collected from a PUDO locker or PAXI point they type in (found on the service's own map).
const PICKUP = {
  pudo: {
    label: 'PUDO locker location',
    short: 'the PUDO locker',
    placeholder: 'e.g. Lifestyle Centre Benoni Locker',
    finder: 'https://www.pudo.co.za',
    find: 'Find a PUDO locker',
  },
  paxi: {
    label: 'PAXI point location',
    short: 'the PAXI point',
    placeholder: 'e.g. PEP Germiston Elsburg (P0137)',
    finder: 'https://www.paxi.co.za/paxi-points',
    find: 'Find a PAXI point',
  },
}
const PHONE_OK = /^\+?[0-9 ()-]{9,20}$/
const POSTAL_OK = /^[0-9]{4}$/
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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
  const [deliverTo, setDeliverTo] = useState('me')
  const [other, setOther] = useState({ name: '', phone: '', email: '', line1: '', suburb: '', city: '', province: '', postal: '', point: '' })
  const [way, setWay] = useState('door')          // 'door' or 'branch'
  const [service, setService] = useState('pudo')  // which branch service

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>
  if (!cart.lines.length && !placed.current) return <Navigate to="/cart" replace />

  const first = cart.lines[0] ? cart.lines[0].product.name : ''
  const itemsLabel = cart.lines.length > 1 ? first + ' + ' + (cart.lines.length - 1) + ' more' : first

  const attach = async file => {
    const stored = await uploadProof(user.id, file)
    setProof(stored)
  }

  const field = f => (
    <label key={f.key} className="field-label">
      {f.label}
      <input
        className="field field-sm"
        type={f.type || 'text'}
        inputMode={f.inputMode}
        maxLength={f.maxLength}
        autoComplete={f.autoComplete}
        value={other[f.key]}
        onChange={e => setOther(prev => ({ ...prev, [f.key]: e.target.value }))}
      />
    </label>
  )

  const place = async () => {
    setError('')
    let deliver = null
    if (deliverTo === 'other') {
      const typed = {}
      Object.keys(other).forEach(k => { typed[k] = other[k].trim() })
      const needed = way === 'door'
        ? [...PERSON_FIELDS, ...ADDRESS_FIELDS]
        : [...PERSON_FIELDS, { key: 'point', short: PICKUP[service].short }]
      const missing = needed.filter(f => !f.optional && !typed[f.key]).map(f => f.short)
      if (missing.length) {
        setError('Please fill in ' + missing.join(', ') + ' for the delivery.')
        return
      }
      if (!PHONE_OK.test(typed.phone)) {
        setError('That phone number does not look right.')
        return
      }
      if (typed.email && !EMAIL_OK.test(typed.email)) {
        setError('That email address does not look right.')
        return
      }
      if (way === 'door' && !POSTAL_OK.test(typed.postal)) {
        setError('The postal code must be 4 digits.')
        return
      }
      deliver = way === 'door'
        ? {
          name: typed.name,
          phone: typed.phone,
          email: typed.email,
          method: 'door',
          line1: typed.line1,
          // Stored as two lines, like the address on an account: "Roodekop, Germiston, Gauteng, 1401".
          line2: [typed.suburb, typed.city, typed.province, typed.postal].join(', '),
        }
        : { name: typed.name, phone: typed.phone, email: typed.email, method: service, point: typed.point }
    } else if (!(user.address && user.address.line1)) {
      setError('Your account has no delivery address. Add it under Account, or choose "Anyone else".')
      return
    }
    setBusy(true)
    try {
      const order = await placeOrder(cart.items, method, method === 'eft' ? proof : null, deliver)
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
        <section className="card card-pad stack gap-12">
          <div className="kicker muted">Deliver to</div>
          <Segmented
            value={deliverTo}
            onChange={setDeliverTo}
            options={[{ value: 'me', label: 'Me' }, { value: 'other', label: 'Anyone else' }]}
          />
          {deliverTo === 'me' ? (
            <div>
              <div className="addr-name">{user.business || user.name}</div>
              <div className="addr-lines">
                {user.address && user.address.line1 ? (
                  <>
                    {user.address.line1}
                    {user.address.line2 && <><br />{user.address.line2}</>}
                  </>
                ) : 'No delivery address on your account yet. Add it under Account.'}
              </div>
            </div>
          ) : (
            <div className="stack gap-10">
              {PERSON_FIELDS.map(field)}
              <div className="field-label">How should it get there?</div>
              <Segmented
                value={way}
                onChange={setWay}
                options={[{ value: 'door', label: 'To their door' }, { value: 'branch', label: 'Collect at a branch' }]}
              />
              {way === 'door' ? (
                <>
                  <p className="hint mb-0">Delivered by The Courier Guy.</p>
                  {ADDRESS_FIELDS.map(field)}
                </>
              ) : (
                <>
                  <Segmented
                    value={service}
                    onChange={setService}
                    options={[{ value: 'pudo', label: 'PUDO locker' }, { value: 'paxi', label: 'PAXI point' }]}
                  />
                  <label className="field-label">
                    {PICKUP[service].label}
                    <input
                      className="field field-sm"
                      autoComplete="off"
                      maxLength={160}
                      placeholder={PICKUP[service].placeholder}
                      value={other.point}
                      onChange={e => setOther(prev => ({ ...prev, point: e.target.value }))}
                    />
                  </label>
                  <p className="hint mb-0">
                    <a className="link-inline" href={PICKUP[service].finder} target="_blank" rel="noreferrer">
                      {PICKUP[service].find}
                    </a>
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="card card-pad stack gap-14">
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
