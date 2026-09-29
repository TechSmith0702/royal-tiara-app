import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { fetchNotifications, markNotificationsRead } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { timeAgo } from '../lib/format.js'
import { ErrorNote, Loading } from '../components/ui.jsx'
import TabBar from '../components/TabBar.jsx'

const ICONS = {
  order: '\u{1F4E6}',
  proof: '\u{1F4B3}',
  application: '\u{1F464}',
  account: '\u2713',
}

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useLive(fetchNotifications, ['notifications'], [])
  const marked = useRef(false)

  const items = data || []
  const unread = items.filter(n => !n.read_at).length

  useEffect(() => {
    if (!unread || marked.current) return
    marked.current = true
    markNotificationsRead().then(refresh).catch(() => {})
  }, [unread, refresh])

  const showTabs = user.role === 'distributor' && user.status === 'approved'

  return (
    <div className="screen">
      <div className="page-top row between center">
        <h2 className="title">Notifications</h2>
        <button type="button" className="btn btn-outline btn-sm btn-inline" onClick={() => navigate(-1)}>Back</button>
      </div>

      <div className="scroll list pt-8">
        {loading && <Loading label="Loading notifications..." />}
        <ErrorNote message={error} onRetry={refresh} />

        {!loading && !error && items.length === 0 && (
          <div className="empty-card mt-6">
            <h3 className="h3-sm">Nothing yet</h3>
            <p className="mb-0">You will be told here when an order moves along or a payment is verified.</p>
          </div>
        )}

        {items.map(n => {
          const body = (
            <>
              <span className="note-icon" aria-hidden="true">{ICONS[n.kind] || '\u2022'}</span>
              <span className="grow min0">
                <span className="note-title">{n.title}</span>
                {n.body && <span className="note-body">{n.body}</span>}
                <span className="note-time">{timeAgo(n.created_at)}</span>
              </span>
            </>
          )
          const className = 'note-row ' + (n.read_at ? '' : 'unread')
          return n.link
            ? <Link key={n.id} to={n.link} className={className}>{body}</Link>
            : <div key={n.id} className={className}>{body}</div>
        })}
      </div>

      {showTabs && <TabBar />}
    </div>
  )
}
