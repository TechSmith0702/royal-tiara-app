import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { fetchThread, markThreadRead, sendMessage } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { ErrorNote, Loading } from '../components/ui.jsx'
import { SendIcon } from '../components/Icons.jsx'
import TabBar from '../components/TabBar.jsx'
import AppMenu from '../components/AppMenu.jsx'
import MessageList from '../components/MessageList.jsx'

export default function Chat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const approved = user.status === 'approved' && user.role === 'distributor'
  const { data: messages, loading, error, refresh } = useLive(
    () => fetchThread(user.id),
    ['messages'],
    [user.id],
  )
  // Other screens can open the chat with a message already started, e.g. a change request (?text=...).
  const [params] = useSearchParams()
  const [started] = useState(() => params.get('text') || '')
  const [text, setText] = useState(started)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState('')
  const marked = useRef(false)

  const unreadCount = (messages || []).filter(m => m.sender_id !== user.id && !m.read_at).length
  useEffect(() => {
    if (!unreadCount || marked.current) return
    marked.current = true
    markThreadRead(user.id).then(refresh).catch(() => {})
  }, [unreadCount, user.id, refresh])

  const send = async e => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSending(true)
    setProblem('')
    try {
      await sendMessage(user.id, user.id, body)
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
      <div className="page-top row between center">
        <div>
          <p className="kicker sage mb-2">Live chat</p>
          <h2 className="title-sm">Royal Tiara</h2>
        </div>
        {!approved && (
          <button type="button" className="btn btn-outline btn-sm btn-inline" onClick={() => navigate('/pending')}>
            Back
          </button>
        )}
        {approved && <AppMenu />}
      </div>

      <div className="scroll chat-scroll">
        {loading && <Loading label="Loading chat..." />}
        <ErrorNote message={error} onRetry={refresh} />
        {!loading && !error && (messages || []).length === 0 && (
          <div className="empty-card empty-sm">
            Say hello. Royal Tiara usually replies during business hours.
          </div>
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
            placeholder="Write a message..."
            aria-label="Message"
            maxLength={2000}
            autoFocus={Boolean(started)}
          />
          <button type="submit" className="send-btn" disabled={sending || !text.trim()} aria-label="Send message">
            <SendIcon />
          </button>
        </div>
      </form>

      {approved && <TabBar />}
    </div>
  )
}
