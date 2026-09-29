import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { useCartCount } from '../lib/cart.js'
import { fetchThread } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { BagIcon, BoxIcon, ChatIcon, HomeIcon } from './Icons.jsx'

const TABS = [
  { to: '/home', label: 'Home', Icon: HomeIcon, match: ['/home'] },
  { to: '/shop', label: 'Shop', Icon: BagIcon, match: ['/shop', '/cart', '/checkout'] },
  { to: '/orders', label: 'Orders', Icon: BoxIcon, match: ['/orders', '/success'] },
  { to: '/chat', label: 'Chat', Icon: ChatIcon, match: ['/chat'] },
]

export default function TabBar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const cartCount = useCartCount(user && user.id)
  const { data: messages } = useLive(
    () => (user ? fetchThread(user.id) : []),
    ['messages'],
    [user && user.id],
  )

  const unread = (messages || []).filter(m => m.sender_id !== (user && user.id) && !m.read_at).length

  const badgeFor = to => {
    if (to === '/shop' && cartCount > 0) return cartCount
    if (to === '/chat' && unread > 0) return unread
    return 0
  }

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon, match }) => {
        const active = match.some(m => pathname.startsWith(m))
        const badge = badgeFor(to)
        return (
          <NavLink
            key={to}
            to={to}
            className={'tab ' + (active ? 'active' : '')}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tab-icon">
              <Icon />
              {badge > 0 && <span className="tab-badge">{badge > 99 ? '99+' : badge}</span>}
            </span>
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}
