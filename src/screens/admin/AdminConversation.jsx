import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import { fetchApplications, fetchThread, markThreadRead, sendMessage } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import { Avatar, BackButton, ErrorNote, Loading } from '../../components/ui.jsx'
import { SendIcon } from '../../components/Icons.jsx'
import MessageList from '../../components/MessageList.jsx'

const STATUS = { pending: 'Applicant', approved: 'Distributor', declined: 'Declined applicant', revoked: 'On hold' }

/**
 * One conversation with a distributor, full screen like the distributor's own
 * chat. Works before anyone has written, so the admin can send the first
 * message.
 */
export default function AdminConversation() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: messages, loading, error, refresh } = useLive(() => fetchThread(id), ['messages'], [id])
  const { data: people } = useLive(fetchApplications, ['profiles'], [])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState('')
  const marked = useRef(false)

  const person = (people || []).find(p => p.id === id)
  const name = person ? person.business || person.name : 'Distributor'
  const first = person ? person.name.split(' ')[0] : ''

  const unreadCount = (messages || []).filter(m => m.sender_id !== user.id && !m.read_at).length
  useEffect(() => {
    if (!unreadCount || marked.current) return
    marked.current = true
    markThreadRead(id).then(refresh).catch(() => {})
  }, [unreadCount, id, refresh])

  const send = async e => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSending(true)
    setProblem('')
    try {
      await sendMessage(id, user.id, body)
      setText('')
      marked.current = false
      refresh()
    } catch (err) {
      setProblem(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to="/admin?tab=chat" label="All chats" />
        <Link to={'/admin/person/' + id} className="row center gap-10 grow min0 chat-who">
          <Avatar name={person ? person.name : '?'} size={40} />
          <span className="min0">
            <span className="cart-name ellipsis">{name}</span>
            <span className="muted-sm">
              {person ? (STATUS[person.status] || 'Distributor') + ' · view details' : ''}
            </span>
          </span>
        </Link>
      </div>

      <div className="scroll chat-scroll">
        {loading && <Loading label="Loading chat..." />}
        <ErrorNote message={error} onRetry={refresh} />
        {!loading && !error && (messages || []).length === 0 && (
          <div className="empty-card empty-sm">No messages yet. Write the first one below.</div>
        )}
        <MessageList messages={messages || []} myId={user.id} />
      </div>

      <form className="chat-bar" onSubmit={send}>
        {problem && <p className="form-error" role="alert">{problem}</p>}
        <div className="row gap-9 center">
          <input
            className="field chat-input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={first ? 'Reply to ' + first + '...' : 'Write a message...'}
            aria-label="Message"
            maxLength={2000}
          />
          <button type="submit" className="send-btn" disabled={sending || !text.trim()} aria-label="Send message">
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  )
}
