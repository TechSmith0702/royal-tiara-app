import { supabase } from './supabase.js'
import { R } from './format.js'

// Used only until the saved fees arrive, and if the database cannot be reached.
export const DELIVERY_FEE = 90
export const JOINING_FEE = 200

/** The fees the admin last saved. Everyone reads the same row. */
export async function fetchFees() {
  const { data, error } = await supabase.from('settings').select('delivery_fee, joining_fee').eq('id', true).single()
  if (error) fail(error)
  return { delivery: Number(data.delivery_fee), joining: Number(data.joining_fee) }
}

export async function adminSaveFees(delivery, joining) {
  const { error } = await supabase.rpc('admin_save_fees', { p_delivery: Number(delivery), p_joining: Number(joining) })
  if (error) fail(error)
}

/** Royal Tiara's bank details, or null until the admin has filled them in. */
export async function fetchBankDetails() {
  const { data, error } = await supabase
    .from('bank_details')
    .select('holder, bank, account_number, branch_code, account_type')
    .eq('id', true)
    .maybeSingle()
  if (error) fail(error)
  if (!data || !data.account_number) return null
  return {
    holder: data.holder,
    bank: data.bank,
    accountNumber: data.account_number,
    branchCode: data.branch_code,
    accountType: data.account_type,
  }
}

export async function adminSaveBankDetails(d) {
  const { error } = await supabase.rpc('admin_save_bank_details', {
    p_holder: d.holder,
    p_bank: d.bank,
    p_account_number: d.accountNumber,
    p_branch_code: d.branchCode,
    p_account_type: d.accountType,
  })
  if (error) fail(error)
}

/* ---------- shaping rows from the database ---------- */

// The bundled photos in /products were converted from PNG/JPG to WebP (about
// 24 times smaller). The database may still hold the old names; photos the
// admin uploaded live in Supabase storage and are left alone.
const bundledPhoto = path => (path || '').replace(/^(\/products\/[^/]+)\.(png|jpe?g)$/i, '$1.webp')

const mapProduct = row => ({
  id: row.id,
  name: row.name,
  sub: row.sub,
  cat: row.cat,
  price: Number(row.price),
  variants: row.variants
    ? row.variants.map(v => ({ label: v.label, price: Number(v.price) }))
    : null,
  sku: row.sku,
  blurb: row.blurb,
  image: bundledPhoto(row.image),
  images: (row.images && row.images.length ? row.images : row.image ? [row.image] : []).map(bundledPhoto),
  inStock: row.in_stock,
  archived: Boolean(row.archived),
})

const mapOrder = row => ({
  id: row.id,
  invoice: row.invoice,
  userId: row.user_id,
  customer: row.customer,
  business: row.business,
  address: { line1: row.address_line1, line2: row.address_line2 },
  createdAt: row.created_at,
  lines: (row.lines || []).map(l => ({ ...l, price: Number(l.price), total: Number(l.total) })),
  subtotal: Number(row.subtotal),
  delivery: Number(row.delivery),
  total: Number(row.total),
  payMethod: row.pay_method,
  proof: row.proof,
  payStatus: row.pay_status,
  fulfil: row.fulfil,
  events: row.events || {},
})

const mapPerson = row => ({
  id: row.id,
  role: row.role,
  status: row.status,
  name: row.name,
  business: row.business,
  phone: row.phone,
  email: row.email,
  address: { line1: row.address_line1, line2: row.address_line2 },
  joinPay: row.join_pay,
  createdAt: row.created_at,
  decidedAt: row.decided_at,
})

export const unitPrice = (p, variant) =>
  p.variants ? p.variants[variant == null ? 0 : variant].price : p.price

export const sizeLabel = (p, variant) =>
  p.variants ? p.variants[variant == null ? 0 : variant].label : p.sub

export const priceLabel = p =>
  p.variants ? R(p.variants[0].price) + ' - ' + R(p.variants[p.variants.length - 1].price) : R(p.price)

/* ---------- errors ---------- */

function fail(error) {
  const message = error.message || 'Something went wrong.'
  if (message.includes('JWT') || message.includes('session')) {
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (message.includes('schema cache') || message.includes('does not exist')) {
    throw new Error('The database is not set up yet. Run supabase/schema.sql in Supabase.')
  }
  throw new Error(message)
}

const rows = ({ data, error }) => (error ? fail(error) : data || [])
const one = ({ data, error }) => (error ? fail(error) : data)

/* ---------- reading ---------- */

export const fetchProducts = async () =>
  rows(await supabase.from('products').select('*').order('sort')).map(mapProduct)

export const fetchOrders = async () =>
  rows(await supabase.from('orders').select('*').order('created_at', { ascending: false })).map(mapOrder)

export const fetchApplications = async () =>
  rows(
    await supabase.from('profiles').select('*').eq('role', 'distributor').order('created_at', { ascending: false }),
  ).map(mapPerson)

export const fetchNotifications = async () =>
  rows(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50))

export const fetchThread = async distributorId =>
  rows(
    await supabase.from('messages').select('*').eq('distributor_id', distributorId).order('created_at'),
  )

/** Admin view: every conversation, newest activity first. */
export async function fetchThreads(myId) {
  const [messages, people] = await Promise.all([
    supabase.from('messages').select('*').order('created_at'),
    supabase.from('profiles').select('*').eq('role', 'distributor'),
  ])
  const all = rows(messages)
  const byId = new Map(rows(people).map(p => [p.id, mapPerson(p)]))

  const threads = new Map()
  all.forEach(m => {
    // Skip anything that is not a distributor's conversation (e.g. an admin
    // who once messaged themselves).
    if (!byId.has(m.distributor_id)) return
    if (!threads.has(m.distributor_id)) {
      const person = byId.get(m.distributor_id)
      threads.set(m.distributor_id, {
        id: m.distributor_id,
        name: person ? person.name : 'Distributor',
        business: person ? person.business : '',
        status: person ? person.status : 'pending',
        messages: [],
        unread: 0,
      })
    }
    const thread = threads.get(m.distributor_id)
    thread.messages.push(m)
    if (m.sender_id !== myId && !m.read_at) thread.unread += 1
  })

  return [...threads.values()]
    .map(t => ({ ...t, last: t.messages[t.messages.length - 1] }))
    .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at))
}

/* ---------- actions ---------- */

export async function placeOrder(items, payMethod, proof) {
  const { data, error } = await supabase.rpc('place_order', {
    p_items: items,
    p_pay_method: payMethod,
    p_proof: proof || null,
  })
  if (error) fail(error)
  return mapOrder(Array.isArray(data) ? data[0] : data)
}

export async function attachProof(orderId, proof) {
  const { error } = await supabase.rpc('attach_proof', { p_order_id: orderId, p_proof: proof })
  if (error) fail(error)
}

/** An unpaid card order becomes a bank transfer, so a proof can be uploaded. */
export async function switchToEft(orderId) {
  const { error } = await supabase.rpc('switch_to_eft', { p_order_id: orderId })
  if (error) fail(error)
}

/** Cancels an unpaid order (the distributor's own, or any for the admin). */
export async function cancelOrder(orderId) {
  const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId })
  if (error) fail(error)
}

/** The distributor confirms the parcel arrived. */
export async function confirmReceipt(orderId) {
  const { error } = await supabase.rpc('confirm_receipt', { p_order_id: orderId })
  if (error) fail(error)
}

export async function adminAdvanceOrder(orderId, step) {
  const { error } = await supabase.rpc('admin_advance_order', { p_order_id: orderId, p_step: step })
  if (error) fail(error)
}

export async function adminDecideApplication(userId, approve) {
  const { error } = await supabase.rpc('admin_decide_application', { p_user: userId, p_approve: approve })
  if (error) fail(error)
}

export async function adminUpdateProduct(productId, { price, inStock }) {
  const { error } = await supabase.rpc('admin_update_product', {
    p_id: productId,
    p_price: price == null ? null : price,
    p_in_stock: inStock == null ? null : inStock,
  })
  if (error) fail(error)
}

/** Admin only: wipe orders, chat and notifications while testing. */
export async function adminResetTestData() {
  const { data, error } = await supabase.rpc('admin_reset_test_data')
  if (error) fail(error)
  return data
}

/** Admin only: create a product (no id) or update one. Returns the product id. */
export async function adminSaveProduct(product) {
  const variants = (product.variants || [])
    .map(v => ({ label: String(v.label).trim(), price: Number(v.price) }))
    .filter(v => v.label && v.price > 0)

  const { data, error } = await supabase.rpc('admin_save_product', {
    p_id: product.id || '',
    p_name: product.name,
    p_sub: product.sub || '',
    p_cat: product.cat,
    p_price: Number(product.price),
    p_blurb: product.blurb || '',
    p_sku: product.sku || '',
    p_variants: variants.length ? variants : null,
    p_archived: Boolean(product.archived),
  })
  if (error) fail(error)
  return data
}

/** Everything a distributor may see (retired products are hidden). */
export const fetchActiveProducts = async () => (await fetchProducts()).filter(p => !p.archived)

/** Admin only: set the photo gallery. The first photo becomes the main one. */
/** Deletes a product for good. Returns its photo links so they can be removed from storage. */
/** Puts a distributor on hold ('revoked') or back in good standing ('approved'). */
export async function adminSetMembership(userId, status) {
  const { error } = await supabase.rpc('admin_set_membership', { p_user: userId, p_status: status })
  if (error) fail(error)
}

export async function adminDeleteProduct(productId) {
  const { data, error } = await supabase.rpc('admin_delete_product', { p_id: productId })
  if (error) fail(error)
  return data || []
}

export async function adminSetProductImages(productId, images) {
  const { error } = await supabase.rpc('admin_set_product_images', { p_id: productId, p_images: images })
  if (error) fail(error)
}

export async function updateProfile(userId, patch) {
  const payload = {}
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.business !== undefined) payload.business = patch.business
  if (patch.phone !== undefined) payload.phone = patch.phone
  if (patch.address) {
    payload.address_line1 = patch.address.line1
    payload.address_line2 = patch.address.line2
  }
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
  if (error) fail(error)
}

/**
 * Deletes the signed-in person's own account for good. Their orders are kept
 * as sales records but no longer point at an account (migration-delete-account.sql).
 */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) fail(error)
}

export async function sendMessage(distributorId, senderId, body) {
  const text = body.trim()
  if (!text) return
  const { error } = await supabase
    .from('messages')
    .insert({ distributor_id: distributorId, sender_id: senderId, body: text })
  if (error) fail(error)
}

export async function markThreadRead(distributorId) {
  const { error } = await supabase.rpc('mark_thread_read', { p_distributor: distributorId })
  if (error) fail(error)
}

export async function markNotificationsRead() {
  const { error } = await supabase.rpc('mark_notifications_read')
  if (error) fail(error)
}

export { one }
