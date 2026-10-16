import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminMoveFeatured, adminSetFeatured, adminUpdateProduct, fetchProducts, priceLabel } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { ErrorNote, Loading, ProductImage, Segmented } from '../../components/ui.jsx'

export default function CatalogueAdmin() {
  const { data, loading, error, refresh } = useLive(fetchProducts, ['products'], [])
  const [problem, setProblem] = useState('')
  const [query, setQuery] = useState('')

  const products = data || []
  const out = products.filter(p => !p.inStock).length
  const q = query.trim().toLowerCase()
  const shown = q
    ? products.filter(p => (p.name + ' ' + p.cat + ' ' + p.sub + ' ' + p.sku).toLowerCase().includes(q))
    : products

  const setStock = async (product, inStock) => {
    setProblem('')
    try {
      await adminUpdateProduct(product.id, { inStock })
      refresh()
    } catch (e) {
      setProblem(e.message)
    }
  }

  // "Moving fast" on the distributor home screen, in order. featuredRank is
  // undefined until the database has been updated for it.
  const canFeature = products.some(p => p.featuredRank !== undefined)
  const featured = products.filter(p => p.featuredRank != null).sort((a, b) => a.featuredRank - b.featuredRank)

  const run = async fn => {
    setProblem('')
    try {
      await fn()
      refresh()
    } catch (e) {
      setProblem(e.message)
    }
  }
  const setFeatured = (product, on) => run(() => adminSetFeatured(product.id, on))
  const move = (product, up) => run(() => adminMoveFeatured(product.id, up))

  return (
    <div className="stack gap-16">
      <div className="stat stat-peach">
        <div className="kicker">Out of stock</div>
        <div className="stat-value">{out}</div>
        <div className="stat-sub">of {products.length} products</div>
      </div>
      <p className="hint mb-0">
        Update your price or mark a product out of stock. Changes reflect on every distributor phone straight away.
        Tap a product to manage its photos.
      </p>

      {canFeature && (
        <section className="card card-pad stack gap-10">
          <div>
            <div className="kicker muted">Moving fast</div>
            <p className="hint mb-0">
              Shown in this order on every distributor's home screen. Add products with the star on each one below.
            </p>
          </div>
          {featured.length === 0 && <div className="muted-sm">None yet - the home screen shows no Moving fast row.</div>}
          {featured.map((p, i) => (
            <div key={p.id} className="row center gap-10 featured-row">
              <span className="featured-pos">{i + 1}</span>
              <span className="grow min0 ellipsis">{p.name}</span>
              <button type="button" className="icon-btn icon-btn-sm" aria-label={'Move ' + p.name + ' up'} disabled={i === 0} onClick={() => move(p, true)}>&uarr;</button>
              <button type="button" className="icon-btn icon-btn-sm" aria-label={'Move ' + p.name + ' down'} disabled={i === featured.length - 1} onClick={() => move(p, false)}>&darr;</button>
              <button type="button" className="icon-btn icon-btn-sm" aria-label={'Remove ' + p.name + ' from Moving fast'} onClick={() => setFeatured(p, false)}>&times;</button>
            </div>
          ))}
        </section>
      )}

      <Link to="/admin/product/new" className="btn btn-primary btn-46">+ Add a product</Link>

      <input
        className="field field-search"
        type="search"
        placeholder={'Search ' + products.length + ' products'}
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Search the catalogue"
      />
      {q && <div className="muted-sm">{shown.length} of {products.length} products</div>}

      {loading && <Loading label="Loading catalogue..." />}
      <ErrorNote message={error} onRetry={refresh} />
      {problem && <p className="form-error" role="alert">{problem}</p>}

      <div className="stack gap-10">
        {shown.map(p => (
          <div key={p.id} className="card admin-product stack gap-12">
            <Link to={'/admin/product/' + p.id} className="row center gap-12">
              <ProductImage product={p} className="admin-img" initialSize={18} />
              <div className="grow min0">
                <div className="cart-name">{p.name}</div>
                <div className="muted-sm">
                  {p.cat} &middot; {p.sub} &middot; {p.images.length ? p.images.length + ' photo' + (p.images.length === 1 ? '' : 's') : 'no photo'}
                  {p.archived && <span className="hidden-flag">Hidden</span>}
                </div>
              </div>
              <span className="chev">&rsaquo;</span>
            </Link>
            <div className="row center gap-10">
              {p.variants
                ? <div className="price-range">{priceLabel(p)}</div>
                : <PriceInput product={p} onProblem={setProblem} onSaved={refresh} />}
              <Segmented
                className="seg-stock grow"
                value={p.inStock ? 'in' : 'out'}
                onChange={v => setStock(p, v === 'in')}
                options={[{ value: 'in', label: 'In stock' }, { value: 'out', label: 'Out' }]}
              />
              {canFeature && (
                <button
                  type="button"
                  className={'icon-btn icon-btn-sm star-btn' + (p.featuredRank != null ? ' on' : '')}
                  aria-label={(p.featuredRank != null ? 'Remove ' + p.name + ' from' : 'Add ' + p.name + ' to') + ' Moving fast'}
                  aria-pressed={p.featuredRank != null}
                  title="Moving fast"
                  onClick={() => setFeatured(p, p.featuredRank == null)}
                >
                  {p.featuredRank != null ? '★' : '☆'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PriceInput({ product, onProblem, onSaved }) {
  const [value, setValue] = useState(String(product.price))
  const [busy, setBusy] = useState(false)

  useEffect(() => { setValue(String(product.price)) }, [product.price])

  const commit = async () => {
    const n = parseInt(value, 10)
    if (!n || n === product.price) {
      setValue(String(product.price))
      return
    }
    setBusy(true)
    onProblem('')
    try {
      await adminUpdateProduct(product.id, { price: n })
      onSaved()
    } catch (e) {
      onProblem(e.message)
      setValue(String(product.price))
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className={'price-input ' + (busy ? 'busy' : '')}>
      <span>R</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={e => setValue(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        aria-label={'Price of ' + product.name + ' in rand'}
      />
    </label>
  )
}
