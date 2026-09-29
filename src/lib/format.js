export const WHATSAPP_DISPLAY = '075 222 5629'
const WHATSAPP_INTL = '27752225629'

/** South African currency: R1 234,56 */
export function R(n) {
  const [whole, cents] = Math.abs(n).toFixed(2).split('.')
  return (n < 0 ? '-R' : 'R') + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + cents
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso) {
  const d = new Date(iso)
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtMonthYear(iso) {
  const d = new Date(iso)
  return `${MON[d.getMonth()]} ${d.getFullYear()}`
}

export function timeAgo(iso) {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000
  if (mins < 2) return 'just now'
  if (mins < 60) return `${Math.round(mins)} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function initials(name = '') {
  const words = name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'RT'
}

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function waLink(text) {
  return `https://wa.me/${WHATSAPP_INTL}${text ? '?text=' + encodeURIComponent(text) : ''}`
}

/** Turns 072 123 4567 / +27 72 123 4567 / 2772... into WhatsApp's 2772... form. */
export function toIntlPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('27')) return digits
  if (digits.startsWith('0')) return '27' + digits.slice(1)
  return digits
}

/** A WhatsApp link to someone else's number (not Royal Tiara's). */
export function waLinkTo(phone, text) {
  const number = toIntlPhone(phone)
  if (!number) return ''
  return `https://wa.me/${number}${text ? '?text=' + encodeURIComponent(text) : ''}`
}

export const pluralise = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`
