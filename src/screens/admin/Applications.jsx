import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminDecideApplication, fetchApplications } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { fmtPhone, timeAgo, waLinkTo } from '../../lib/format.js'
import { ErrorNote, Loading, StatusChip } from '../../components/ui.jsx'
import { useConfirm } from '../../components/ConfirmDialog.jsx'

const joiningFeeLabel = p =>
  p.joinFeePaidAt
    ? 'paid'
    : p.status === 'approved' && p.joinFeePaidAt === null
      ? 'not paid yet'
      : p.joinPay === 'card' ? 'card once approved' : 'bank transfer - check proof on WhatsApp'

export default function Applications() {
  const { data, loading, error, refresh } = useLive(fetchApplications, ['profiles'], [])
  const [busyId, setBusyId] = useState(null)
  const [problem, setProblem] = useState('')
  const [query, setQuery] = useState('')
  const [ask, dialog] = useConfirm()

  const people = data || []
  const pending = people.filter(p => p.status === 'pending')
  const q = query.trim().toLowerCase()
  const others = people
    .filter(p => p.status !== 'pending')
    .filter(p => !q || [p.name, p.business, p.email, p.phone, p.address.line1, p.address.line2].join(' ').toLowerCase().includes(q))

  const decide = async (person, approve) => {
    if (!approve) {
      const ok = await ask({
        title: 'Decline ' + (person.business || person.name) + '?',
        body: 'They will see that their application was not approved and cannot order. You can still chat to them.',
        yes: 'Decline',
        no: 'Keep reviewing',
        danger: true,
      })
      if (!ok) return
    }
    setBusyId(person.id)
    setProblem('')
    try {
      await adminDecideApplication(person.id, approve)
      refresh()
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="stack gap-18">
      {dialog}
      <div className="stat stat-peach">
        <div className="kicker">Applications</div>
        <div className="stat-value">{pending.length}</div>
        <div className="stat-sub">awaiting review</div>
      </div>

      {loading && <Loading label="Loading applications..." />}
      <ErrorNote message={error} onRetry={refresh} />
      {problem && <p className="form-error" role="alert">{problem}</p>}

      {!loading && (
        <div>
          <h3 className="section-title mb-10">Waiting for approval</h3>
          <div className="stack gap-10">
            {pending.length === 0 && <div className="empty-card empty-sm">No new applications.</div>}
            {pending.map(p => (
              <PersonCard key={p.id} person={p}>
                <div className="row gap-9">
                  <button
                    type="button"
                    className="btn btn-primary btn-44 grow"
                    disabled={busyId === p.id}
                    onClick={() => decide(p, true)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-44 grow"
                    disabled={busyId === p.id}
                    onClick={() => decide(p, false)}
                  >
                    Decline
                  </button>
                </div>
              </PersonCard>
            ))}
          </div>
        </div>
      )}

      {!loading && people.length > pending.length && (
        <div className="stack gap-10">
          <h3 className="section-title">Distributors &middot; {people.length - pending.length}</h3>
          <input
            className="field field-search"
            type="search"
            placeholder="Search name, business, phone or town"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search distributors"
          />
          {others.length === 0 && <div className="empty-card empty-sm">No distributors match "{query.trim()}".</div>}
          {others.map(p => <PersonCard key={p.id} person={p} />)}
        </div>
      )}
    </div>
  )
}

function PersonCard({ person: p, children }) {
  return (
    <div className="card card-pad-sm stack gap-12">
      <div className="row between start gap-10">
        <Link className="min0 person-link" to={'/admin/person/' + p.id}>
          <div className="app-name">{p.business || p.name}</div>
          <div className="row-sub">
            {p.business && p.business !== p.name ? p.name + ' · ' : ''}
            {p.address.line2 ? p.address.line2 + ' · ' : ''}applied {timeAgo(p.createdAt)}
          </div>
          {p.address.line1 && <div className="row-sub">{p.address.line1}</div>}
          <div className="row-sub">
            {p.email}
            {p.phone && (
              <>
                {' · '}
                <a
                  className="link-inline"
                  href={waLinkTo(p.phone, 'Hi ' + p.name + ', this is Royal Tiara about your trade account.')}
                  target="_blank"
                  rel="noreferrer"
                >
                  {fmtPhone(p.phone)}
                </a>
              </>
            )}
          </div>
          <div className="row-sub">Joining fee: {joiningFeeLabel(p)}</div>
          <div className="row-sub link-inline">View details &rsaquo;</div>
        </Link>
        {p.status === 'approved' && <StatusChip tone="sage">Approved</StatusChip>}
        {p.status === 'declined' && <StatusChip tone="grey">Declined</StatusChip>}
        {p.status === 'revoked' && <StatusChip tone="oos">On hold</StatusChip>}
      </div>
      {children}
    </div>
  )
}
