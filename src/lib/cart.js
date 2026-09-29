import { useMemo, useSyncExternalStore } from 'react'
import { DELIVERY_FEE, sizeLabel, unitPrice } from './db.js'

// The cart stays on this device until the order is placed.
const keyFor = userId => 'royal-tiara-cart-' + userId
const listeners = new Set()
let version = 0

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
const bump = () => { version += 1; listeners.forEach(fn => fn()) }

function read(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(keyFor(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(userId, lines) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(lines))
  } catch {
    // private browsing - the cart just will not be remembered
  }
  bump()
}

export function addToCart(userId, productId, variant, qty) {
  const lines = read(userId)
  const v = variant === undefined ? null : variant
  const found = lines.find(l => l.productId === productId && l.variant === v)
  if (found) found.qty += qty
  else lines.push({ productId, variant: v, qty })
  write(userId, lines)
}

export function changeCartQty(userId, index, delta) {
  const lines = read(userId)
  if (!lines[index]) return
  lines[index].qty += delta
  if (lines[index].qty <= 0) lines.splice(index, 1)
  write(userId, lines)
}

export const clearCart = userId => write(userId, [])
export const replaceCart = (userId, lines) => write(userId, lines)

export function useCart(userId, products) {
  useSyncExternalStore(subscribe, () => version)
  return useMemo(() => {
    const lines = read(userId).map((line, index) => {
      const product = (products || []).find(p => p.id === line.productId)
      if (!product) return null
      const price = unitPrice(product, line.variant)
      return {
        ...line,
        index,
        product,
        price,
        size: sizeLabel(product, line.variant),
        total: price * line.qty,
      }
    }).filter(Boolean)

    const subtotal = lines.reduce((t, l) => t + l.total, 0)
    const units = lines.reduce((t, l) => t + l.qty, 0)
    const delivery = lines.length ? DELIVERY_FEE : 0

    return {
      lines,
      subtotal,
      units,
      delivery,
      total: subtotal + delivery,
      hasOutOfStock: lines.some(l => !l.product.inStock),
      items: lines.map(l => ({ productId: l.productId, variant: l.variant, qty: l.qty })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, products, version])
}

/** Just the number of items, for the tab bar badge. */
export function useCartCount(userId) {
  useSyncExternalStore(subscribe, () => version)
  return read(userId).reduce((total, line) => total + line.qty, 0)
}
