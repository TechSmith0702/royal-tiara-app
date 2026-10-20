import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { addToCart, useCart } from '../lib/cart.js'
import { fetchActiveProducts, sizeLabel, unitPrice } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { pluralise, R, waLink } from '../lib/format.js'
import { BagIcon } from '../components/Icons.jsx'
import { BackButton, ErrorNote, FitPhoto, Loading, PhotoViewer, ProductImage, Stepper } from '../components/ui.jsx'

export default function Product() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: products, loading, error, refresh } = useLive(fetchActiveProducts, ['products'], [])
  const cart = useCart(user.id, products)
  const [variant, setVariant] = useState(0)
  const [qty, setQty] = useState(1)
  const [photo, setPhoto] = useState(0)
  const [viewing, setViewing] = useState(false)
  const [added, setAdded] = useState(false)
  const timer = useRef(null)

  useEffect(() => { setVariant(0); setQty(1); setPhoto(0); setViewing(false); setAdded(false) }, [id])
  useEffect(() => () => clearTimeout(timer.current), [])

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>
  if (error) return <div className="screen"><div className="scroll page"><ErrorNote message={error} onRetry={refresh} /></div></div>

  const p = (products || []).find(x => x.id === id)
  if (!p) return <Navigate to="/shop" replace />

  const price = unitPrice(p, variant)
  const shown = photo > 0 && p.images[photo] ? { ...p, image: p.images[photo] } : p
  // Stays on this page, so a distributor can carry on adding other products.
  const add = () => {
    addToCart(user.id, p.id, p.variants ? variant : null, qty)
    setQty(1)
    setAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 1600)
  }

  return (
    <div className="screen">
      <div className="scroll">
        <div className="page-top row between center">
          <BackButton to="/shop" />
          <span className="tier-short">Distributor price</span>
        </div>

        <div className="px-22 pt-4 stack gap-10">
          <div
            className={p.images.length ? 'tappable' : undefined}
            onClick={p.images.length ? () => setViewing(true) : undefined}
            role={p.images.length ? 'button' : undefined}
            aria-label={p.images.length ? 'View full photo' : undefined}
          >
            <ProductImage product={shown} className="hero-img" initialSize={52} fit />
          </div>
          {viewing && shown.image && <PhotoViewer src={shown.image} alt={p.name} onClose={() => setViewing(false)} />}
          {p.images.length > 1 && (
            <div className="thumb-row">
              {p.images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  className={'thumb fit-box ' + (i === photo ? 'on' : '')}
                  onClick={() => setPhoto(i)}
                  aria-label={'Photo ' + (i + 1) + ' of ' + p.images.length}
                  aria-pressed={i === photo}
                >
                  <FitPhoto src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-22 pt-18 pb-24 stack gap-16">
          <div>
            <div className="kicker sage">{p.cat}</div>
            <h2 className="detail-title">{p.name}</h2>
            <p className="detail-sub">{p.sub}</p>
          </div>

          {p.variants && (
            <div className="stack gap-8">
              <div className="kicker sage">Choose size</div>
              <div className="row gap-10">
                {p.variants.map((v, k) => (
                  <button
                    key={v.label}
                    type="button"
                    className={'variant ' + (k === variant ? 'selected' : '')}
                    aria-pressed={k === variant}
                    onClick={() => setVariant(k)}
                  >
                    <span className="variant-label">{v.label}</span>
                    <span className="variant-price">{R(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card-dark">
            <div className="kicker on-dark">Your price</div>
            <div className="price-big">{R(price)}</div>
            <div className="per-unit">per unit</div>
          </div>

          <div className="card card-pad">
            <h4 className="about-title">About this line</h4>
            <p className="about-text">{p.blurb}</p>
            <div className="tag-row">
              {p.inStock
                ? <span className="tag tag-sage">In stock</span>
                : <span className="tag tag-oos">Out of stock</span>}
            </div>
          </div>

          <a
            className="btn btn-outline-sage"
            target="_blank"
            rel="noreferrer"
            href={waLink('Hi Royal Tiara, I have a question about ' + p.name + ' (' + sizeLabel(p, variant) + ').')}
          >
            Ask about this product on WhatsApp
          </a>
        </div>
      </div>

      {/* Always on screen, however long the description. */}
      <div className="bottom-bar buy-bar stack gap-10">
        {cart.lines.length > 0 && (
          <Link to="/cart" className="btn btn-outline cart-btn" aria-live="polite">
            <span className="row center gap-8"><BagIcon /> View cart</span>
            <span className="cart-btn-sum">{pluralise(cart.units, 'item')} · {R(cart.subtotal)} &rsaquo;</span>
          </Link>
        )}
        <div className="row center gap-12">
          <Stepper value={qty} onDec={() => setQty(q => Math.max(1, q - 1))} onInc={() => setQty(q => q + 1)} />
          <button type="button" className={'btn grow ' + (added ? 'btn-sage' : 'btn-primary')} onClick={add} disabled={!p.inStock}>
            {!p.inStock ? 'Out of stock' : added ? 'Added to cart ✓' : 'Add · ' + R(price * qty)}
          </button>
        </div>
      </div>
    </div>
  )
}
