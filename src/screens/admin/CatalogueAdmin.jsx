import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminUpdateProduct, fetchProducts, priceLabel } from '../../lib/db.js'
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
