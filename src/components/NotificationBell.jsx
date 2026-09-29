import { Link } from 'react-router-dom'
import { fetchNotifications } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { BellIcon } from './Icons.jsx'

export default function NotificationBell() {
  const { data } = useLive(fetchNotifications, ['notifications'], [])
  const unread = (data || []).filter(n => !n.read_at).length

  return (
    <Link to="/notifications" className="bell" aria-label={unread ? unread + ' new notifications' : 'Notifications'}>
      <BellIcon />
      {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  )
}
