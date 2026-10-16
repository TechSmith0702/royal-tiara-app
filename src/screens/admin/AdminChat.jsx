import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import { fetchApplications, fetchThreads, markThreadRead, sendMessage } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { timeAgo } from '../../lib/format.js'
import { Avatar, ErrorNote, Loading } from '../../components/ui.jsx'
import { SendIcon } from '../../components/Icons.jsx'
import MessageList from '../../components/MessageList.jsx'

export default function AdminChat() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const openId = params.get('thread')
  const { data, loading, error, refresh } = useLive(
    () => fetchThreads(user.id),
    ['messages', 'profiles'],
    [user.id],
  )
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState('')
  const marked = useRef('')

  const { data: people } = useLive(fetchApplications, ['profiles'], [])

  const threads = data || []
  // Opened from a distributor's page before either side has written: start an
  // empty conversation so the admin can send the first message.
  const person = !threads.some(t => t.id === openId) && (people || []).find(p => p.id === openId)
  const thread = threads.find(t => t.id === openId) || (person && {
    id: person.id,
    name: person.name,
    business: person.business,
    status: person.status,
    messages: [],
    unread: 0,
  })

  useEffect(() => {
    if (!thread || !thread.unread || marked.current === thread.id) return
    marked.current = thread.id
    markThreadRead(thread.id).then(refresh).catch(() => {})
  }, [thread, refresh])

  const open = id => setParams({ tab: 'chat', thread: id }, { replace: true })
  const back = () => { marked.current = ''; setParams({ tab: 'chat' }, { replace: true }) }

  const send = async e => {
    e.preventDefault()
    const body = text.trim()
    if (!body || !thread) return
    setSending(true)
    setProblem('')
    try {
      await sendMessage(thread.id, user.id, body)
      setText('')
      refresh()
    } catch (err) {
      setProblem(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Loading label="Loading chats..." />
  if (error) return <ErrorNote message={error} onRetry={refresh} />

  if (thread) {
    return (
      <div className="stack gap-12">
        <div className="row between center gap-10">
          <div className="row center gap-10 min0">
            <Avatar name={thread.name} size={40} />
            <div className="min0">
              <div className="cart-name">{thread.business || thread.name}</div>
              <div className="muted-sm">{thread.status === 'approved' ? 'Distributor' : 'Applicant'}</div>
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm btn-inline" onClick={back}>All chats</button>
        </div>

        <div className="admin-thread">
          {thread.messages.length
            ? <MessageList messages={thread.messages} myId={user.id} />
            : <p className="muted-sm center mb-0">No messages yet. Write the first one below.</p>}
        </div>

        {problem && <p className="form-error" role="alert">{problem}</p>}
        <form className="row gap-9 center" onSubmit={send}>
          <input
            className="field chat-input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'Reply to ' + thread.name.split(' ')[0] + '...'}
            aria-label="Reply"
            maxLength={2000}
          />
          <button type="submit" className="send-btn" disabled={sending || !text.trim()} aria-label="Send reply">
            <SendIcon />
          </button>
        </form>
      </div>
    )
  }

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
          <button key={t.id} type="button" className="thread-row" onClick={() => open(t.id)}>
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
