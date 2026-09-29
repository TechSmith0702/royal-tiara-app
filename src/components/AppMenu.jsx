import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { signOut, useAuth } from '../lib/auth.jsx'
import { useCartCount } from '../lib/cart.js'
import { fetchThread } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { WHATSAPP_DISPLAY, waLink } from '../lib/format.js'
import { Avatar } from './ui.jsx'
import { BagIcon, BoxIcon, ChatIcon, HomeIcon, ReceiptIcon, UserIcon } from './Icons.jsx'

const ADMIN_LINKS = [
  { to: '/admin', tab: 'apps', label: 'Applications', Icon: UserIcon },
  { to: '/admin?tab=sales', tab: 'sales', label: 'Sales', Icon: ReceiptIcon },
  { to: '/admin?tab=catalogue', tab: 'catalogue', label: 'Catalogue', Icon: BagIcon },
  { to: '/admin?tab=chat', tab: 'chat', label: 'Chat', Icon: ChatIcon },
]

const LINKS = [
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: '/shop', label: 'Shop', Icon: BagIcon, badge: 'cart' },
  { to: '/orders', label: 'Orders', Icon: BoxIcon },
  { to: '/invoices', label: 'Invoices', Icon: ReceiptIcon },
  { to: '/chat', label: 'Chat', Icon: ChatIcon, badge: 'chat' },
  { to: '/account', label: 'Account', Icon: UserIcon },
]

/** The three lines in the top corner, and the menu that slides in from the right. */
export default function AppMenu() {
  const { user } = useAuth()
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const cartCount = useCartCount(user && user.id)
  const { data: messages } = useLive(
    () => (user && user.role !== 'admin' ? fetchThread(user.id) : []),
    ['messages'],
    [user && user.id],
  )

  useEffect(() => { setOpen(false) }, [pathname, search])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!user) return null

  const admin = user.role === 'admin'
  const links = admin ? ADMIN_LINKS : LINKS
  const unread = (messages || []).filter(m => m.sender_id !== user.id && !m.read_at).length
  const badgeFor = key => (key === 'cart' ? cartCount : key === 'chat' ? unread : 0)
  const tabNow = new URLSearchParams(search).get('tab') || 'apps'

  return (
    <>
      <button
        type="button"
        className="menu-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span /><span /><span />
      </button>

      {open && createPortal(
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <nav
            className="drawer"
            aria-label="Menu"
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer-head row center gap-12">
              <Avatar name={user.name} />
              <div className="min0 grow">
                <div className="drawer-name ellipsis">{user.business || user.name}</div>
                <div className="muted-sm">{user.role === 'admin' ? 'Admin' : 'Distributor'}</div>
              </div>
              <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
                &times;
              </button>
            </div>

            <div className="drawer-links">
              {links.map(({ to, tab, label, Icon, badge }) => {
                const count = badgeFor(badge)
                const here = admin ? pathname === '/admin' && tab === tabNow : pathname.startsWith(to)
                return (
                  <Link
                    key={to}
                    to={to}
                    className={'drawer-link ' + (here ? 'on' : '')}
                    aria-current={here ? 'page' : undefined}
                  >
                    <Icon />
                    <span className="grow">{label}</span>
                    {count > 0 && <span className="drawer-badge">{count > 99 ? '99+' : count}</span>}
                  </Link>
                )
              })}
            </div>

            <div className="drawer-foot stack gap-10">
              <a className="help-line" href={waLink()} target="_blank" rel="noreferrer">
                <span className="dot" />Need help? WhatsApp {WHATSAPP_DISPLAY}
              </a>
              <button type="button" className="btn btn-outline btn-44" onClick={signOut}>Sign out</button>
            </div>
          </nav>
        </div>,
        document.body,
      )}
    </>
  )
}
