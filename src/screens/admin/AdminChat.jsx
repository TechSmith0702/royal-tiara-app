import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import { fetchThreads } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { timeAgo } from '../../lib/format.js'
import { Avatar, ErrorNote, Loading } from '../../components/ui.jsx'

/**
 * The Chat tab of the admin console: every conversation, newest first. Each
 * one opens full screen (AdminConversation), like the distributor's chat.
 */
export default function AdminChat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data, loading, error, refresh } = useLive(
    () => fetchThreads(user.id),
    ['messages', 'profiles'],
    [user.id],
  )

  // Older links (notifications, bookmarks) still point at ?thread=<id>.
  const openId = params.get('thread')
  if (openId) return <Navigate to={'/admin/chat/' + openId} replace />

  if (loading) return <Loading label="Loading chats..." />
  if (error) return <ErrorNote message={error} onRetry={refresh} />

  const threads = data || []
  const unreadTotal = threads.reduce((t, x) => t + x.unread, 0)

  return (
    <div className="stack gap-16">
      <div className="stat stat-sage">
        <div className="kicker">Chats</div>
        <div className="stat-value">{unreadTotal}</div>
        <div className="stat-sub">unread messages</div>
      </div>

      {threads.length === 0 && (
        <div className="empty-card empty-sm">
          No chats yet. Distributor messages appear here. To message someone first, open them under Applications and
          tap Open chat.
        </div>
      )}

      <div className="stack gap-10">
        {threads.map(t => (
          <button key={t.id} type="button" className="thread-row" onClick={() => navigate('/admin/chat/' + t.id)}>
            <Avatar name={t.name} size={44} />
            <span className="grow min0">
              <span className="row between center gap-8">
                <span className="thread-name">{t.business || t.name}</span>
                <span className="thread-time">{timeAgo(t.last.created_at)}</span>
              </span>
              <span className="thread-last">{t.last.body}</span>
            </span>
            {t.unread > 0 && <span className="thread-badge">{t.unread}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
