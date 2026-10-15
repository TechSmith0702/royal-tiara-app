import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminDecideApplication, adminSetMembership, fetchApplications, fetchOrders } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { R, fmtDate, timeAgo, waLinkTo } from '../../lib/format.js'
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

  const decide = approve => run(() => adminDecideApplication(p.id, approve))

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
                <div className="app-name">{p.business || p.name}</div>
                <div className="row-sub">{p.business ? p.name : 'Distributor'}</div>
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
              {p.phone} (WhatsApp)
            </a>
          </Line>
          <Line label="Delivery">{p.address.line1}</Line>
          <Line label="Town">{p.address.line2}</Line>
        </section>

        <section className="card card-pad stack gap-10">
          <div className="kicker muted">Account</div>
          <Line label="Applied">{fmtDate(p.createdAt)} &middot; {timeAgo(p.createdAt)}</Line>
          {p.decidedAt && <Line label="Decided">{fmtDate(p.decidedAt)}</Line>}
          <Line label="Joining fee">
            {p.joinPay === 'card' ? 'By card once approved' : 'Bank transfer - proof on WhatsApp'}
          </Line>
          <Line label="Orders">
            {orderList.loading ? 'Loading...' : orders.length === 0 ? 'None yet' : orders.length + ' · ' + R(spent) + ' paid'}
          </Line>
          {orders[0] && <Line label="Last order">{orders[0].invoice} &middot; {timeAgo(orders[0].createdAt)}</Line>}
        </section>

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

        <Link className="btn btn-outline btn-46" to="/admin?tab=chat">Open chat</Link>

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
