import { fmtDate, R } from './format.js'

const cents = n => Math.round(n * 100) / 100

// How an order travels. "door" is The Courier Guy; the others are collected
// from a pickup point the distributor typed at checkout.
export const DELIVERY_METHODS = {
  door: { courier: 'The Courier Guy', badge: 'COURIER GUY', pickup: false },
  pudo: { courier: 'PUDO', badge: 'PUDO', pickup: true, place: 'PUDO locker' },
  paxi: { courier: 'PAXI', badge: 'PAXI', pickup: true, place: 'PAXI point' },
}
export const deliveryMethod = order => DELIVERY_METHODS[order.deliveryMethod] || DELIVERY_METHODS.door

/** Where it goes, as lines to show: an address, or the pickup point. */
export function deliveryLines(order) {
  const m = deliveryMethod(order)
  if (m.pickup) return ['Collect from ' + m.place + ': ' + order.pickupPoint]
  return [order.address.line1, order.address.line2].filter(Boolean)
}

/**
 * Everything the distributor and admin screens show about an order is worked
 * out here, so the tracking always mirrors what the admin has done.
 */
export function orderState(order, audience) {
  const forAdmin = audience === 'admin'
  const byCard = order.payMethod === 'card'
  const hasProof = byCard || Boolean(order.proof)
  const verified = order.payStatus === 'verified'
  // Each stage counts as done once a later stage is reached.
  const packed = ['packed', 'collected', 'delivered'].includes(order.fulfil)
  const collected = ['collected', 'delivered'].includes(order.fulfil)
  const delivered = order.fulfil === 'delivered'
  const cancelled = order.fulfil === 'cancelled'
  // What has been paid so far. After an approved change it can be less than
  // the total (a balance to pay) or more (a refund to make).
  const paid = order.paidAmount || 0
  // Paid from money Royal Tiara owed the distributor ("amount payable to you").
  const creditUsed = order.creditUsed || 0
  // Money actually paid by card or bank transfer.
  const realPaid = cents(paid - creditUsed)
  const due = verified ? 0 : Math.max(0, cents(order.total - paid))
  // Part-paid after an approved change: a balance is still to pay.
  const balance = !verified && realPaid > 0
  const paidFromCredit = verified && creditUsed > 0 && realPaid <= 0
  // A distributor can cancel until money is paid or they upload a proof
  // (after that they may already have paid). The admin can cancel any unpaid order.
  const canCancel = realPaid <= 0 && !order.fulfil && (forAdmin || !order.proof)
  // Items can change until the order is packed: directly while no money is
  // paid, otherwise as a request Royal Tiara approves.
  const canEditItems = !order.fulfil && realPaid <= 0 && !order.proof && !order.changeRequest
  const canRequestChange = !order.fulfil && realPaid > 0 && !(!verified && order.proof) && !order.changeRequest

  const status = cancelled ? 'Cancelled'
    : delivered ? 'Delivered'
    : collected ? 'In transit'
    : packed ? 'Packed for collection'
    : verified ? 'Payment verified'
    : balance ? (order.proof ? 'Balance under review' : 'Balance due')
    : byCard ? 'Awaiting card payment'
    : hasProof ? 'Payment under review'
    : 'Awaiting payment'

  const waybill = cancelled
    ? (order.events.cancelled_by === 'admin' ? 'Cancelled by Royal Tiara' : forAdmin ? 'Cancelled by the distributor' : 'You cancelled this order') + ' - nothing is owed'
    : delivered ? 'Delivered - thank you!'
    : collected ? 'Collected by courier - on the way to you'
    : packed ? 'Packed for collection by the courier'
    : verified ? 'Payment verified - being packed'
    : balance ? (order.proof ? 'Balance payment under review' : 'Your order changed - ' + R(due) + ' still to pay')
    : byCard ? 'Waiting for the card payment to be confirmed'
    : hasProof ? 'Payment under review'
    : 'Awaiting proof of payment'

  const steps = cancelled ? [
    { label: 'Order placed', done: true, when: fmtDate(order.createdAt) },
    { label: 'Cancelled', done: true, when: fmtDate(order.events.cancelled || order.createdAt) },
  ] : [
    { label: 'Order placed', done: true, when: fmtDate(order.createdAt) },
    byCard
      ? {
        // A card order is only paid once PayFast (or Royal Tiara) confirms it.
        label: verified ? 'Paid by card' : 'Card payment',
        done: verified,
        when: verified ? fmtDate(order.events.verified || order.createdAt) : 'Not confirmed yet',
      }
      : {
        // Royal Tiara can verify a payment that was sent on WhatsApp instead of uploaded.
        label: hasProof || !verified ? 'Proof of payment received' : 'Payment received',
        done: hasProof || verified,
        when: hasProof
          ? fmtDate(order.events.proof || order.createdAt)
          : paidFromCredit
            ? 'From the amount payable to you'
            : verified
              ? 'Confirmed by Royal Tiara'
              : 'Awaiting upload',
      },
    { label: 'Payment verified', done: verified, when: verified ? 'Confirmed' : 'Pending review' },
    { label: 'Packed for collection', done: packed, when: packed ? 'Waiting for the courier' : '-' },
    {
      label: 'Collected by courier',
      done: collected,
      when: collected ? (forAdmin ? 'In transit to client' : 'In transit to you') : '-',
    },
    {
      label: 'Delivered',
      done: delivered,
      when: delivered ? fmtDate(order.events.delivered) : (forAdmin ? 'Waiting for the client' : 'Tap below when it arrives'),
    },
  ]

  const invoice = cancelled
    ? { label: 'Cancelled', tone: 'grey' }
    : verified
      ? { label: 'Paid', tone: 'sage' }
    : balance && !order.proof
      ? { label: 'Balance due', tone: 'peach' }
      : order.proof
        ? { label: 'Under review', tone: 'sage' }
        : { label: byCard ? 'Awaiting card payment' : 'Awaiting proof', tone: 'peach' }

  return {
    byCard,
    hasProof,
    verified,
    packed,
    collected,
    delivered,
    cancelled,
    canCancel,
    canEditItems,
    canRequestChange,
    paid,
    creditUsed,
    realPaid,
    paidFromCredit,
    due,
    balance,
    status,
    waybill,
    steps,
    invoice,
    // Green once paid or a proof is in; amber while payment is still owed.
    tone: cancelled ? 'grey' : verified || order.proof ? 'sage' : 'peach',
  }
}

/** Still to be paid, packed or delivered (cancelled orders are not). */
export const isOpen = order => order.fulfil !== 'delivered' && order.fulfil !== 'cancelled'

export const unitsIn = order => order.lines.reduce((t, l) => t + l.qty, 0)
