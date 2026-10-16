import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminDecideApplication, fetchApplications } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { timeAgo, waLinkTo } from '../../lib/format.js'
import { ErrorNote, Loading, StatusChip } from '../../components/ui.jsx'

export default function Applications() {
  const { data, loading, error, refresh } = useLive(fetchApplications, ['profiles'], [])
  const [busyId, setBusyId] = useState(null)
  const [problem, setProblem] = useState('')

  const people = data || []
  const pending = people.filter(p => p.status === 'pending')

  const decide = async (person, approve) => {
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
      <div className="stat stat-peach">
        <div className="kicker">Applications</div>
        <div className="stat-value">{pending.length}</div>
        <div className="stat-sub">awaiting review</div>
      </div>

      <div>
        <h3 className="section-title mb-10">Trade applications</h3>
        {loading && <Loading label="Loading applications..." />}
        <ErrorNote message={error} onRetry={refresh} />
        {problem && <p className="form-error" role="alert">{problem}</p>}

        <div className="stack gap-10">
          {!loading && people.length === 0 && (
            <div className="empty-card empty-sm">No applications yet.</div>
          )}

          {people.map(p => (
            <div key={p.id} className="card card-pad-sm stack gap-12">
              <div className="row between start gap-10">
                <Link className="min0 person-link" to={'/admin/person/' + p.id}>
                  <div className="app-name">{p.business || p.name}</div>
                  <div className="row-sub">
                    {p.name}{p.address.line2 ? ' \u00b7 ' + p.address.line2 : ''} &middot; applied {timeAgo(p.createdAt)}
                  </div>
                  {p.address.line1 && <div className="row-sub">{p.address.line1}</div>}
                  <div className="row-sub">
                    {p.email}
                    {p.phone && (
                      <>
                        {' \u00b7 '}
                        <a
                          className="link-inline"
                          href={waLinkTo(p.phone, 'Hi ' + p.name + ', this is Royal Tiara about your trade application.')}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.phone}
                        </a>
                      </>
                    )}
                  </div>
                  <div className="row-sub">
                    Joining fee:{' '}
                    {p.joinFeePaidAt
                      ? 'paid'
                      : p.status === 'approved' && p.joinFeePaidAt === null
                        ? 'not paid yet'
                        : p.joinPay === 'card' ? 'card once approved' : 'bank transfer - check proof on WhatsApp'}
                  </div>
                  <div className="row-sub link-inline">View details &rsaquo;</div>
                </Link>
                {p.status === 'approved' && <StatusChip tone="sage">Approved</StatusChip>}
                {p.status === 'declined' && <StatusChip tone="grey">Declined</StatusChip>}
                {p.status === 'revoked' && <StatusChip tone="oos">On hold</StatusChip>}
              </div>

              {p.status === 'pending' && (
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
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
