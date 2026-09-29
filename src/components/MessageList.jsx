import { useEffect, useRef } from 'react'
import { fmtDate } from '../lib/format.js'

const time = iso => {
  const d = new Date(iso)
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

export default function MessageList({ messages, myId }) {
  const endRef = useRef(null)

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ block: 'end' })
  }, [messages.length])

  let lastDay = ''

  return (
    <div className="messages">
      {messages.map(m => {
        const day = fmtDate(m.created_at)
        const showDay = day !== lastDay
        lastDay = day
        const mine = m.sender_id === myId
        return (
          <div key={m.id}>
            {showDay && <div className="chat-day">{day}</div>}
            <div className={'bubble-row ' + (mine ? 'mine' : 'theirs')}>
              <div className={'bubble ' + (mine ? 'bubble-mine' : 'bubble-theirs')}>
                <span className="bubble-text">{m.body}</span>
                <span className="bubble-time">
                  {time(m.created_at)}
                  {mine && m.read_at && <span className="bubble-read"> &middot; read</span>}
                </span>
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
