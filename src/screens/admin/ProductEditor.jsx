import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CATEGORIES } from '../../data/products.js'
import { adminDeleteProduct, adminSaveProduct, adminSetProductImages, fetchProducts } from '../../lib/db.js'
import { deleteProductPhoto, uploadProductPhoto } from '../../lib/files.js'
import { useLive } from '../../lib/live.js'
import { BackButton, ErrorNote, FilePicker, FitPhoto, Loading, PhotoViewer } from '../../components/ui.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'

const BLANK = { name: '', sub: '', cat: '', price: '', blurb: '', sku: '', variants: [], archived: false }
const onlyPrice = value => value.replace(/[^0-9.]/g, '')

export default function ProductEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const { data, loading, error, refresh } = useLive(fetchProducts, ['products'], [])
  const [form, setForm] = useState(BLANK)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [saved, setSaved] = useState('')
  const [viewing, setViewing] = useState(null)
  const [ask, dialog] = useConfirm()

  const product = isNew ? null : (data || []).find(p => p.id === id)

  useEffect(() => {
    if (isNew || !product || loaded) return
    setForm({
      name: product.name,
      sub: product.sub || '',
      cat: product.cat,
      price: String(product.price),
      blurb: product.blurb || '',
      sku: product.sku || '',
      variants: (product.variants || []).map(v => ({ label: v.label, price: String(v.price) })),
      archived: product.archived,
    })
    setLoaded(true)
  }, [isNew, product, loaded])

  if (loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>
  if (error) return <div className="screen"><div className="scroll page"><ErrorNote message={error} onRetry={refresh} /></div></div>

  if (!isNew && !product) {
    return (
      <div className="screen">
        <div className="page-top row center gap-12">
          <BackButton to="/admin?tab=catalogue" />
          <h2 className="title-sm">Not found</h2>
        </div>
        <div className="scroll page"><div className="empty-card empty-sm">That product no longer exists.</div></div>
      </div>
    )
  }

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const photos = product ? product.images || [] : []

  const save = async () => {
    setBusy(true)
    setProblem('')
    setSaved('')
    try {
      const newId = await adminSaveProduct({ ...form, id: isNew ? '' : product.id })
      refresh()
      if (isNew) navigate('/admin/product/' + newId, { replace: true })
      else setSaved('Saved.')
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  const saveGallery = async next => {
    setBusy(true)
    setProblem('')
    try {
      await adminSetProductImages(product.id, next)
      refresh()
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  const addPhoto = async file => {
    if (photos.length >= 8) throw new Error('Up to 8 photos per product.')
    const url = await uploadProductPhoto(product.id, file)
    await saveGallery([...photos, url])
  }

  const removePhoto = async url => {
    if (!(await ask({ title: 'Remove this photo?', yes: 'Remove', danger: true }))) return
    await saveGallery(photos.filter(p => p !== url))
    try {
      await deleteProductPhoto(url)
    } catch {
      /* the gallery is updated either way */
    }
  }

  const deleteProduct = async () => {
    const ok = await ask({
      title: 'Delete ' + product.name + ' for good?',
      body: 'It disappears from the catalogue and its photos are removed. Past orders and invoices keep their details. '
        + 'This cannot be undone.',
      yes: 'Delete product',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    setProblem('')
    try {
      const images = await adminDeleteProduct(product.id)
      await Promise.allSettled(images.map(deleteProductPhoto))
      navigate('/admin?tab=catalogue', { replace: true })
    } catch (e) {
      setProblem(e.message)
      setBusy(false)
    }
  }

  const addSize = () => set('variants', [...form.variants, { label: '', price: '' }])
  const setSize = (i, key, value) =>
    set('variants', form.variants.map((v, k) => (k === i ? { ...v, [key]: value } : v)))
  const removeSize = i => set('variants', form.variants.filter((_, k) => k !== i))

  return (
    <div className="screen">
      {dialog}
      <div className="page-top row center gap-12">
        <BackButton to="/admin?tab=catalogue" />
        <h2 className="title-sm ellipsis">{isNew ? 'New product' : product.name}</h2>
      </div>

      <div className="scroll px-22 pb-24 stack gap-16">
        {viewing && <PhotoViewer src={viewing} alt={product.name} onClose={() => setViewing(null)} />}

        {!isNew && (
          <>
            <div
              className={'big-photo ' + (photos[0] ? 'fit-box tappable' : '')}
              onClick={photos[0] ? () => setViewing(photos[0]) : undefined}
              role={photos[0] ? 'button' : undefined}
              aria-label={photos[0] ? 'View full photo' : undefined}
            >
              {photos[0]
                ? <FitPhoto key={photos[0]} src={photos[0]} alt={product.name} />
                : <span className="img-initial" style={{ fontSize: 56 }}>{product.name.charAt(0)}</span>}
            </div>

            <div className="stack gap-10">
              <div className="kicker muted">Photos ({photos.length}/8) &middot; the first shows in the catalogue</div>
              <div className="photo-grid">
                {photos.map((url, i) => (
                  <div key={url} className={'photo-tile ' + (i === 0 ? 'is-main' : '')}>
                    <div className="photo-frame fit-box tappable" onClick={() => setViewing(url)}>
                      <FitPhoto src={url} alt={product.name + ' photo ' + (i + 1)} />
                    </div>
                    {i === 0 && <span className="photo-flag">Main</span>}
                    <div className="photo-actions">
                      {i !== 0 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => saveGallery([url, ...photos.filter(p => p !== url)])}
                        >
                          Make main
                        </button>
                      )}
                      <button type="button" className="danger" disabled={busy} onClick={() => removePhoto(url)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <FilePicker className="btn btn-outline btn-46" onPicked={addPhoto} busyLabel="Uploading...">
                Add a photo
              </FilePicker>
            </div>
          </>
        )}

        <div className="stack gap-12">
          <div className="kicker muted">Details</div>

          <label className="field-label">
            Product name
            <input
              className="field"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Batana Growth Spray"
            />
          </label>

          <label className="field-label">
            Category
            <input
              className="field"
              list="rt-categories"
              value={form.cat}
              onChange={e => set('cat', e.target.value)}
              placeholder="e.g. Batana"
            />
          </label>
          <datalist id="rt-categories">
            {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
          </datalist>

          <label className="field-label">
            Size shown under the name
            <input
              className="field"
              value={form.sub}
              onChange={e => set('sub', e.target.value)}
              placeholder="e.g. 250ml"
            />
          </label>

          <label className="field-label">
            Price (rand)
            <input
              className="field"
              inputMode="decimal"
              value={form.price}
              onChange={e => set('price', onlyPrice(e.target.value))}
              placeholder="e.g. 135"
            />
          </label>

          <label className="field-label">
            Description
            <textarea
              className="field field-area"
              rows={5}
              value={form.blurb}
              onChange={e => set('blurb', e.target.value)}
              placeholder="What it does, what is in it, who it is for."
            />
          </label>

          <label className="field-label">
            Product code (optional)
            <input className="field" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="e.g. RT-BGS" />
          </label>
        </div>

        <div className="stack gap-10">
          <div className="kicker muted">Sizes with their own prices (optional)</div>
          <p className="hint mb-0">
            Leave this empty for a one-size product. Add rows only when the same product comes in different sizes,
            like Batana Oil 50ml and 100ml.
          </p>
          {form.variants.map((v, i) => (
            <div key={i} className="row gap-9 center">
              <input
                className="field field-sm grow"
                value={v.label}
                onChange={e => setSize(i, 'label', e.target.value)}
                placeholder="50ml"
                aria-label={'Size ' + (i + 1) + ' name'}
              />
              <input
                className="field field-sm size-price"
                inputMode="decimal"
                value={v.price}
                onChange={e => setSize(i, 'price', onlyPrice(e.target.value))}
                placeholder="149"
                aria-label={'Size ' + (i + 1) + ' price'}
              />
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => removeSize(i)} aria-label="Remove this size">
                &times;
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-44" onClick={addSize}>Add a size</button>
        </div>

        <label className="archive-row">
          <input type="checkbox" checked={form.archived} onChange={e => set('archived', e.target.checked)} />
          <span className="grow">
            <span className="cart-name">Hide from distributors</span>
            <span className="muted-sm">For products you no longer sell. Past orders keep their history.</span>
          </span>
        </label>

        {problem && <p className="form-error" role="alert">{problem}</p>}
        {saved && <p className="form-note" role="status">{saved}</p>}

        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving...' : isNew ? 'Create product' : 'Save changes'}
        </button>

        {!isNew && (
          <div className="danger-zone stack gap-10">
            <div className="muted-sm">
              Selling it again later? Tick &ldquo;Hide from distributors&rdquo; instead &mdash; that can be undone.
            </div>
            <button type="button" className="btn btn-danger btn-46" onClick={deleteProduct} disabled={busy}>
              Delete product
            </button>
          </div>
        )}

        <p className="hint mb-0">
          {isNew
            ? 'You can add photos once the product is created.'
            : 'Price and stock can also be changed quickly from the Catalogue list.'}
        </p>
      </div>
    </div>
  )
}
