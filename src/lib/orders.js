import { fmtDate } from './format.js'

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

  const status = delivered ? 'Delivered'
    : collected ? 'In transit'
    : packed ? 'Packed & ready'
    : verified ? 'Payment verified'
    : hasProof ? 'Payment under review'
    : 'Awaiting payment'

  const waybill = delivered ? 'Delivered - thank you!'
    : collected ? 'Collected by courier - on the way to you'
    : packed ? 'Packed & ready for collection'
    : verified ? 'Payment verified - being packed'
    : byCard ? 'Card payment - being confirmed'
    : hasProof ? 'Payment under review'
    : 'Awaiting proof of payment'

  const steps = [
    { label: 'Order placed', done: true, when: fmtDate(order.createdAt) },
    {
      // Royal Tiara can verify a payment that was sent on WhatsApp instead of uploaded.
      label: byCard ? 'Paid by card' : hasProof || !verified ? 'Proof of payment received' : 'Payment received',
      done: hasProof || verified,
      when: hasProof
        ? fmtDate(order.events.proof || order.createdAt)
        : verified
          ? 'Confirmed by Royal Tiara'
          : 'Awaiting upload',
    },
    { label: 'Payment verified', done: verified, when: verified ? 'Confirmed' : 'Pending review' },
    { label: 'Packed & ready', done: packed, when: packed ? 'Ready to collect' : '-' },
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

  const invoice = verified
    ? { label: 'Paid', tone: 'sage' }
    : hasProof
      ? { label: 'Under review', tone: 'sage' }
      : { label: 'Awaiting proof', tone: 'peach' }

  return {
    byCard,
    hasProof,
    verified,
    packed,
    collected,
    delivered,
    status,
    waybill,
    steps,
    invoice,
    tone: hasProof || verified ? 'sage' : 'peach',
  }
}

export const unitsIn = order => order.lines.reduce((t, l) => t + l.qty, 0)
