import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { initials } from '../lib/format.js'

export function Avatar({ name, size = 46, dark = false }) {
  return (
    <span
      className={'avatar ' + (dark ? 'avatar-dark' : '')}
      style={{ width: size, height: size, fontSize: Math.round(size / 3.1) }}
    >
      {initials(name)}
    </span>
  )
}

export function BackButton({ to, label = 'Back' }) {
  return <Link to={to} className="icon-btn" aria-label={label}>&lsaquo;</Link>
}

export function ActiveDot({ label = 'Active' }) {
  return <span className="active-dot"><span className="dot" />{label}</span>
}

export function Stepper({ value, onDec, onInc, small = false, label = 'quantity' }) {
  return (
    <div className={'stepper ' + (small ? 'stepper-sm' : '')}>
      <button type="button" onClick={onDec} aria-label={'Decrease ' + label}>&minus;</button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={onInc} aria-label={'Increase ' + label}>+</button>
    </div>
  )
}

/** A photo shown whole, with a soft blurred copy of itself filling any gaps around it. */
export function FitPhoto({ src, alt, onError }) {
  return (
    <>
      <img className="fit-backdrop" src={src} alt="" aria-hidden="true" loading="lazy" />
      <img className="fit-photo" src={src} alt={alt} onError={onError} loading="lazy" />
    </>
  )
}

export function ProductImage({ product, className = '', initialSize = 24, fit = false }) {
  const [failed, setFailed] = useState(false)
  const show = product.image && !failed
  return (
    <div className={'img-box ' + (fit && show ? 'fit-box ' : '') + className}>
      {show && fit ? (
        <FitPhoto src={product.image} alt={product.name} onError={() => setFailed(true)} />
      ) : show ? (
        <img src={product.image} alt={product.name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="img-initial" style={{ fontSize: initialSize }}>{product.name.charAt(0)}</span>
      )}
    </div>
  )
}

export function Segmented({ options, value, onChange, dark = false, className = '' }) {
  return (
    <div className={'seg ' + (dark ? 'seg-dark ' : '') + className} role="radiogroup">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StatusChip({ tone = 'sage', children }) {
  return <span className={'status-chip status-' + tone}>{children}</span>
}

/** Opens the file picker and hands the chosen file back to the caller. */
export function FilePicker({ onPicked, className, busyLabel = 'Uploading...', children }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handle = async e => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await onPicked(file)
    } catch (err) {
      setError(err.message || 'Could not attach that file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => input.current.click()} disabled={busy}>
        {busy ? busyLabel : children}
      </button>
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={handle} />
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  )
}

export function Loading({ label = 'Loading...' }) {
  return <div className="loading"><span className="spinner" />{label}</div>
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="form-error" role="alert">
      {message}
      {onRetry && <button type="button" className="text-btn" onClick={onRetry}>Try again</button>}
    </div>
  )
}

/** Full-screen view of one photo, uncropped. Tap anywhere or press Esc to close. */
export function PhotoViewer({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button type="button" className="viewer-close" aria-label="Close photo" onClick={onClose}>&times;</button>
      <img src={src} alt={alt} />
    </div>,
    document.body,
  )
}
