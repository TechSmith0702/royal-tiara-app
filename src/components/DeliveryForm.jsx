import { useState } from 'react'
import { Segmented } from './ui.jsx'
import { fmtPhone } from '../lib/format.js'

/*
 * Where an order goes: to the distributor ("Me": their account address, another
 * address such as work, or a PUDO locker / PAXI point), or to someone else at
 * their door (The Courier Guy) or a PUDO locker / PAXI point.
 * "Me" somewhere other than the account address is sent like "Someone else",
 * with the distributor's own name and phone as the recipient.
 * Used by checkout, and by the order page to change it before packing.
 */

// Someone else receiving the order: the courier needs their name, number and address.
const PERSON_FIELDS = [
  { key: 'name', label: 'Their name', short: 'their name', autoComplete: 'off' },
  { key: 'phone', label: 'Their phone number', short: 'their phone number', type: 'tel', inputMode: 'tel', autoComplete: 'off' },
  { key: 'email', label: 'Their email (optional)', optional: true, type: 'email', inputMode: 'email', autoComplete: 'off' },
]
// To their door, by The Courier Guy.
const ADDRESS_FIELDS = [
  { key: 'line1', label: 'Street address', short: 'the street address', autoComplete: 'off' },
  { key: 'suburb', label: 'Suburb', short: 'the suburb', autoComplete: 'off' },
  { key: 'city', label: 'City / Town', short: 'the city or town', autoComplete: 'off' },
  { key: 'province', label: 'Province', short: 'the province', autoComplete: 'off' },
  { key: 'postal', label: 'Postal code', short: 'the postal code', inputMode: 'numeric', maxLength: 4, autoComplete: 'off' },
]
// Or collected from a PUDO locker or PAXI point they type in. Google Maps opens
// fast on any phone; the service's own map is the fallback (The Courier Guy's
// map sits behind a slow "checking you are not a bot" page).
const PICKUP = {
  pudo: {
    label: 'PUDO locker location',
    short: 'the PUDO locker',
    placeholder: 'e.g. Lifestyle Centre Benoni Locker',
    maps: 'https://www.google.com/maps/search/?api=1&query=PUDO+locker',
    finder: 'https://www.thecourierguy.co.za/locker-location-map',
    finderName: "The Courier Guy's locker map",
    what: "locker's name and area",
  },
  paxi: {
    label: 'PAXI point location',
    short: 'the PAXI point',
    placeholder: 'e.g. PEP Germiston Elsburg (P0137)',
    maps: 'https://www.google.com/maps/search/?api=1&query=PAXI+point',
    finder: 'https://www.paxi.co.za/paxi-points',
    finderName: "PAXI's map",
    what: 'PAXI point name and code',
  },
}
const PHONE_OK = /^\+?[0-9 ()-]{9,20}$/
const POSTAL_OK = /^[0-9]{4}$/
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const BLANK = { name: '', phone: '', email: '', line1: '', suburb: '', city: '', province: '', postal: '', point: '' }

/** "Roodekop, Germiston, Gauteng, 1401" back into its four boxes. */
function splitLine2(line2) {
  const parts = String(line2 || '').split(',').map(s => s.trim())
  if (parts.length === 4) return { suburb: parts[0], city: parts[1], province: parts[2], postal: parts[3] }
  return { suburb: line2 || '' }
}

const digits = s => String(s || '').replace(/\D/g, '')
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

/** An order going to the distributor themselves, at another address or a pickup point. */
function isSelf(order, user) {
  return Boolean(user) && sameText(order.recipientName, user.name) && digits(order.recipientPhone) === digits(user.phone)
}

/** What the form starts with: empty at checkout, or an order's current delivery. */
function startFrom(order, user) {
  if (!order || order.deliverTo !== 'other') {
    return { deliverTo: 'me', mine: 'account', way: 'door', service: 'pudo', other: BLANK }
  }
  const pickup = order.deliveryMethod === 'pudo' || order.deliveryMethod === 'paxi'
  const self = isSelf(order, user)
  return {
    deliverTo: self ? 'me' : 'other',
    mine: self ? (pickup ? 'branch' : 'door') : 'account',
    way: pickup ? 'branch' : 'door',
    service: pickup ? order.deliveryMethod : 'pudo',
    other: {
      ...BLANK,
      ...(self ? {} : { name: order.recipientName, phone: order.recipientPhone, email: order.recipientEmail }),
      ...(pickup ? { point: order.pickupPoint } : { line1: order.address.line1, ...splitLine2(order.address.line2) }),
    },
  }
}

/**
 * The delivery form. Returns { form, build }: show `form`, and call build()
 * when submitting. build() gives { deliver } (null means the distributor's
 * own address) or { problem } with a message to show.
 */
export function useDeliveryForm(user, order) {
  const [start] = useState(() => startFrom(order, user))
  const [deliverTo, setDeliverTo] = useState(start.deliverTo)
  const [mine, setMine] = useState(start.mine)       // for "Me": 'account', 'door' or 'branch'
  const [other, setOther] = useState(start.other)
  const [way, setWay] = useState(start.way)          // for "Someone else": 'door' or 'branch'
  const [service, setService] = useState(start.service)  // which branch service

  const build = () => {
    if (deliverTo === 'me' && mine === 'account') {
      if (!(user.address && user.address.line1)) {
        return { problem: 'Your account has no delivery address. Choose "Elsewhere", or add it under Account.' }
      }
      return { deliver: null }
    }
    const self = deliverTo === 'me'
    const how = self ? mine : way
    const typed = {}
    Object.keys(other).forEach(k => { typed[k] = String(other[k] || '').trim() })
    // Going to the distributor somewhere else: the courier contacts them.
    if (self) {
      typed.name = String(user.name || user.business || '').trim()
      typed.phone = String(user.phone || '').trim()
      typed.email = String(user.email || '').trim()
      if (!typed.name || !PHONE_OK.test(typed.phone)) {
        return { problem: 'Add your name and phone number under Account first, so the courier can reach you.' }
      }
      if (typed.email && !EMAIL_OK.test(typed.email)) typed.email = ''
    }
    const needed = [
      ...(self ? [] : PERSON_FIELDS),
      ...(how === 'door' ? ADDRESS_FIELDS : [{ key: 'point', short: PICKUP[service].short }]),
    ]
    const missing = needed.filter(f => !f.optional && !typed[f.key]).map(f => f.short)
    if (missing.length) return { problem: 'Please fill in ' + missing.join(', ') + ' for the delivery.' }
    if (!PHONE_OK.test(typed.phone)) return { problem: 'That phone number does not look right.' }
    if (typed.email && !EMAIL_OK.test(typed.email)) return { problem: 'That email address does not look right.' }
    if (how === 'door' && !POSTAL_OK.test(typed.postal)) return { problem: 'The postal code must be 4 digits.' }
    return {
      deliver: how === 'door'
        ? {
          name: typed.name,
          phone: typed.phone,
          email: typed.email,
          method: 'door',
          line1: typed.line1,
          // Stored as two lines, like the address on an account: "Roodekop, Germiston, Gauteng, 1401".
          line2: [typed.suburb, typed.city, typed.province, typed.postal].join(', '),
        }
        : { name: typed.name, phone: typed.phone, email: typed.email, method: service, point: typed.point },
    }
  }

  const field = f => (
    <label key={f.key} className="field-label">
      {f.label}
      <input
        className="field field-sm"
        type={f.type || 'text'}
        inputMode={f.inputMode}
        maxLength={f.maxLength}
        autoComplete={f.autoComplete}
        value={other[f.key]}
        onChange={e => setOther(prev => ({ ...prev, [f.key]: e.target.value }))}
      />
    </label>
  )

  // A street address typed in (door delivery by The Courier Guy).
  const addressBoxes = (
    <>
      <p className="hint mb-0">Delivered by The Courier Guy.</p>
      {ADDRESS_FIELDS.map(field)}
    </>
  )

  // A PUDO locker or PAXI point typed in, with help finding one.
  const pickupBoxes = (
    <>
      <Segmented
        value={service}
        onChange={setService}
        options={[{ value: 'pudo', label: 'PUDO locker' }, { value: 'paxi', label: 'PAXI point' }]}
      />
      <label className="field-label">
        {PICKUP[service].label}
        <input
          className="field field-sm"
          autoComplete="off"
          maxLength={160}
          placeholder={PICKUP[service].placeholder}
          value={other.point}
          onChange={e => setOther(prev => ({ ...prev, point: e.target.value }))}
        />
      </label>
      <p className="hint mb-0">
        Typing the {PICKUP[service].what} is enough. Not sure which one?{' '}
        <a className="link-inline" href={PICKUP[service].maps} target="_blank" rel="noreferrer">
          Search Google Maps
        </a>{' '}
        or{' '}
        <a className="link-inline" href={PICKUP[service].finder} target="_blank" rel="noreferrer">
          {PICKUP[service].finderName}
        </a>
        {service === 'pudo' && ' (it can take a while to open)'}.
      </p>
    </>
  )

  const form = (
    <>
      <Segmented
        value={deliverTo}
        onChange={setDeliverTo}
        options={[{ value: 'me', label: 'Me' }, { value: 'other', label: 'Someone else' }]}
      />
      {deliverTo === 'me' ? (
        <div className="stack gap-10">
          <Segmented
            value={mine}
            onChange={setMine}
            options={[
              { value: 'account', label: 'My address' },
              { value: 'door', label: 'Elsewhere' },
              { value: 'branch', label: 'Collect' },
            ]}
          />
          {mine === 'account' && (
            <div>
              <div className="addr-name">{user.business || user.name}</div>
              <div className="addr-lines">
                {user.address && user.address.line1 ? (
                  <>
                    {user.address.line1}
                    {user.address.line2 && <><br />{user.address.line2}</>}
                  </>
                ) : 'No delivery address on your account yet. Choose "Elsewhere", or add it under Account.'}
              </div>
            </div>
          )}
          {mine === 'door' && (
            <>
              <p className="hint mb-0">
                For this order only, for example your work address. The courier calls you on {user.phone ? fmtPhone(user.phone) : 'the number on your account'}.
              </p>
              {ADDRESS_FIELDS.map(field)}
            </>
          )}
          {mine === 'branch' && pickupBoxes}
        </div>
      ) : (
        <div className="stack gap-10">
          {PERSON_FIELDS.map(field)}
          <div className="field-label">How should it get there?</div>
          <Segmented
            value={way}
            onChange={setWay}
            options={[{ value: 'door', label: 'To their door' }, { value: 'branch', label: 'Collect' }]}
          />
          {way === 'door' ? addressBoxes : pickupBoxes}
        </div>
      )}
    </>
  )

  return { form, build }
}