import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminDecideApplication, adminMarkJoiningPaid, adminPersonDetails, adminSetMembership, fetchApplications, fetchOrders } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { R, fmtDate, fmtPhone, timeAgo, waLinkTo } from '../../lib/format.js'
import { Avatar, BackButton, ErrorNote, Loading, StatusChip } from '../../components/ui.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'

const CHIP = {
  pending: { tone: 'peach', label: 'Awaiting review' },
  approved: { tone: 'sage', label: 'Approved' },
  declined: { tone: 'grey', label: 'Declined' },
  revoked: { tone: 'oos', label: 'On hold' },
}

function Line({ label, children }) {
  if (!children) return null
  return (
    <div className="person-line">
      <span className="person-label">{label}</span>
      <span className="person-value">{children}</span>
    </div>
  )
}

export default function Person() {
  const { id } = useParams()
  const people = useLive(fetchApplications, ['profiles'], [])
  const orderList = useLive(fetchOrders, ['orders'], [])
  const { data: details } = useLive(() => adminPersonDetails(id), [], [id])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [ask, dialog] = useConfirm()

  if (people.loading) return <div className="screen"><div className="scroll page"><Loading /></div></div>
  if (people.error) {
    return (
      <div className="screen">
        <div className="scroll page"><ErrorNote message={people.error} onRetry={people.refresh} /></div>
      </div>
    )
  }

  const p = (people.data || []).find(x => x.id === id)
  if (!p) {
    return (
      <div className="screen">
        <div className="page-top row center gap-12">
          <BackButton to="/admin" />
          <h2 className="title-sm">Not found</h2>
        </div>
        <div className="scroll page"><div className="empty-card empty-sm">That distributor no longer exists.</div></div>
      </div>
    )
  }

  const chip = CHIP[p.status] || CHIP.pending
  const orders = (orderList.data || []).filter(o => o.userId === p.id)
  const spent = orders.filter(o => o.payStatus === 'verified').reduce((sum, o) => sum + o.total, 0)

  const run = async fn => {
    setBusy(true)
    setProblem('')
    try {
      await fn()
      people.refresh()
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  const decide = async approve => {
    if (!approve) {
      const ok = await ask({
        title: 'Decline ' + (p.business || p.name) + '?',
        body: 'They will see that their application was not approved and cannot order. You can still chat to them, and approve them later.',
        yes: 'Decline',
        no: 'Keep reviewing',
        danger: true,
      })
      if (!ok) return
    }
    run(() => adminDecideApplication(p.id, approve))
  }

  const revoke = async () => {
    const ok = await ask({
      title: 'Put ' + (p.business || p.name) + ' on hold?',
      body: 'They keep their account and past orders, but cannot place new orders until you restore them.',
      yes: 'Put on hold',
      danger: true,
    })
    if (!ok) return
    run(() => adminSetMembership(p.id, 'revoked'))
  }

  const restore = () => run(() => adminSetMembership(p.id, 'approved'))

  const markJoiningPaid = async () => {
    const ok = await ask({
      title: 'Mark the joining fee as paid?',
      body: 'Only do this once the money has reflected in the Royal Tiara account. ' + (p.business || p.name) + ' can then start ordering.',
      yes: 'Mark paid',
    })
    if (!ok) return
    run(() => adminMarkJoiningPaid(p.id))
  }

  // undefined means the database has no joining-fee columns yet.
  const joinFeeDue = p.status === 'approved' && p.joinFeePaidAt === null

  return (
    <div className="screen">
      {dialog}
      <div className="page-top row center gap-12">
        <BackButton to="/admin" />
        <h2 className="title-sm ellipsis">{p.business || p.name}</h2>
      </div>

      <div className="scroll px-22 pb-24 stack gap-16">
        <section className="card card-pad stack gap-12">
          <div className="row between start gap-12">
            <div className="row center gap-12 min0">
              <Avatar name={p.name} />
              <div className="min0">
                {/* The name is already the page title, so only add what is new. */}
                <div className="row-sub">
                  {p.business && p.business !== p.name ? 'Owner: ' + p.name : p.status === 'pending' ? 'Applicant' : 'Distributor'}
                </div>
              </div>
            </div>
            <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
          </div>

          {p.status === 'revoked' && (
            <p className="hint mb-0">
              On hold{p.decidedAt ? ' since ' + fmtDate(p.decidedAt) : ''}. They can sign in and see past orders, but cannot place new ones.
            </p>
          )}
        </section>

        <section className="card card-pad stack gap-10">
          <div className="kicker muted">Contact</div>
          <Line label="Email"><a className="link-inline" href={'mailto:' + p.email}>{p.email}</a></Line>
          <Line label="Phone">
            <a
              className="link-inline"
              target="_blank"
              rel="noreferrer"
              href={waLinkTo(p.phone, 'Hi ' + p.name + ', this is Royal Tiara.')}
            >
              {fmtPhone(p.phone)} (WhatsApp)
            </a>
          </Line>
          <Line label="Delivery">{p.address.line1}</Line>
          <Line label="Town">{p.address.line2}</Line>
        </section>

        <section className="card card-pad stack gap-10">
          <div className="kicker muted">Account</div>
          <Line label="Applied">{fmtDate(p.createdAt)} &middot; {timeAgo(p.createdAt)}</Line>
          {details && (
            <Line label="Email">
              {details.emailConfirmedAt ? 'Confirmed ' + fmtDate(details.emailConfirmedAt) : 'Not confirmed yet - they cannot sign in until they do'}
            </Line>
          )}
          {details && (
            <Line label="Last signed in">{details.lastSignInAt ? timeAgo(details.lastSignInAt) : 'Never'}</Line>
          )}
          {details && (
            <Line label="Terms">
              {details.termsAcceptedAt
                ? 'Agreed ' + fmtDate(details.termsAcceptedAt) + (details.termsVersion ? ' (version ' + details.termsVersion + ')' : '')
                : 'Not on record - applied before the terms tick box'}
            </Line>
          )}
          {details && details.monthlyMinimumAccepted && (
            <Line label="Monthly minimum">Ticked: “{details.monthlyMinimumAccepted}”</Line>
          )}
          {p.decidedAt && <Line label="Decided">{fmtDate(p.decidedAt)}</Line>}
          <Line label="Joining fee">
            {p.joinFeePaidAt
              ? 'Paid' + (p.joinFeeAmount ? ' ' + R(p.joinFeeAmount) : '') + ' on ' + fmtDate(p.joinFeePaidAt)
                + (p.joinFeeReference ? ' · ' + p.joinFeeReference : '')
              : joinFeeDue
                ? 'Not paid yet - they cannot order until it is'
                : p.joinPay === 'card' ? 'By card once approved' : 'Bank transfer - proof on WhatsApp'}
          </Line>
          {p.credit > 0 && <Line label="Payable to them">{R(p.credit)} &middot; comes off their next order</Line>}
          <Line label="Orders">
            {orderList.loading ? 'Loading...' : orders.length === 0 ? 'None yet' : orders.length + ' · ' + R(spent) + ' paid'}
          </Line>
          {orders[0] && <Line label="Last order">{orders[0].invoice} &middot; {timeAgo(orders[0].createdAt)}</Line>}
        </section>

        {joinFeeDue && (
          <button type="button" className="btn btn-sage btn-46" disabled={busy} onClick={markJoiningPaid}>
            Joining fee received - mark paid
          </button>
        )}

        {problem && <p className="form-error" role="alert">{problem}</p>}

        {p.status === 'pending' && (
          <div className="row gap-9">
            <button type="button" className="btn btn-primary btn-46 grow" disabled={busy} onClick={() => decide(true)}>
              Approve
            </button>
            <button type="button" className="btn btn-outline btn-46 grow" disabled={busy} onClick={() => decide(false)}>
              Decline
            </button>
          </div>
        )}

        <Link className="btn btn-outline btn-46" to={'/admin/chat/' + p.id}>Open chat</Link>

        {p.status === 'approved' && (
          <div className="danger-zone stack gap-10">
            <div className="muted-sm">
              Putting someone on hold stops new orders. Their account, chat and past orders stay exactly as they are,
              and you can restore them at any time.
            </div>
            <button type="button" className="btn btn-danger btn-46" disabled={busy} onClick={revoke}>
              Put membership on hold
            </button>
          </div>
        )}

        {(p.status === 'revoked' || p.status === 'declined') && (
          <button type="button" className="btn btn-primary btn-46" disabled={busy} onClick={restore}>
            {p.status === 'revoked' ? 'Restore membership' : 'Approve after all'}
          </button>
        )}
      </div>
    </div>
  )
}
