import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../data/products.js'
import { useAuth } from '../lib/auth.jsx'
import { addToCart, useCart } from '../lib/cart.js'
import { fetchActiveProducts, priceLabel } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { R } from '../lib/format.js'
import { ErrorNote, Loading, ProductImage } from '../components/ui.jsx'
import TabBar from '../components/TabBar.jsx'
import AppMenu from '../components/AppMenu.jsx'

export default function Catalogue() {
  const { user } = useAuth()
  const { data: products, loading, error, refresh } = useLive(fetchActiveProducts, ['products'], [])
  const cart = useCart(user.id, products)
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') || 'All'
  const [query, setQuery] = useState('')
  const [justAdded, setJustAdded] = useState(null)
  const timer = useRef()

  useEffect(() => () => clearTimeout(timer.current), [])

  // Categories the admin adds (e.g. Teas) get a chip too, after the usual ones.
  const categories = [...CATEGORIES]
  for (const p of products || []) if (p.cat && !categories.includes(p.cat)) categories.push(p.cat)

  const q = query.trim().toLowerCase()
  const rows = (products || []).filter(p =>
    (cat === 'All' || p.cat === cat) && (!q || (p.name + ' ' + p.cat + ' ' + p.sub).toLowerCase().includes(q)))

  const quickAdd = p => {
    addToCart(user.id, p.id, null, 1)
    setJustAdded(p.id)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setJustAdded(null), 1200)
  }

  return (
    <div className="screen">
      <div className="page-head stack gap-12">
        <div className="row between center"><h2 className="title">Catalogue</h2><AppMenu /></div>
        <input
          className="field field-search"
          type="search"
          placeholder={'Search ' + ((products || []).length || '') + ' products'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search products"
        />
        <div className="chips">
          {categories.map(c => (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={c === cat}
              onClick={() => setParams(c === 'All' ? {} : { cat: c }, { replace: true })}
            >
              {c === cat && <span className="chip-dot" />}{c}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll list">
        {loading && <Loading label="Loading catalogue..." />}
        <ErrorNote message={error} onRetry={refresh} />
        {!loading && !error && rows.length === 0 && (
          <div className="empty-card empty-sm">No products match that search.</div>
        )}

        {rows.map(p => (
          <div key={p.id} className="product-row">
            <Link to={'/shop/' + p.id} className="row-link">
              <ProductImage product={p} className="row-img" />
              <div className="grow min0">
                <div className="row-name">{p.name}</div>
                <div className="row-sub">{p.sub}</div>
                <div className="row-price">
                  {priceLabel(p)}
                  {!p.inStock && <span className="oos-inline">Out of stock</span>}
                </div>
              </div>
            </Link>
            {p.variants ? (
              <Link to={'/shop/' + p.id} className="add-btn" aria-label={'Choose a size of ' + p.name}>+</Link>
            ) : (
              <button
                type="button"
                className="add-btn"
                onClick={() => quickAdd(p)}
                disabled={!p.inStock}
                aria-label={'Add ' + p.name + ' to cart'}
              >
                {justAdded === p.id ? '\u2713' : '+'}
              </button>
            )}
          </div>
        ))}
      </div>

      {cart.lines.length > 0 && (
        <div className="float-bar">
          <Link to="/cart" className="btn btn-dark btn-split">
            <span>View cart</span><span>{R(cart.subtotal)} &rsaquo;</span>
          </Link>
        </div>
      )}
      <TabBar />
    </div>
  )
}
