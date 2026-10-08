import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { signOut, useAuth } from '../../lib/auth.jsx'
import { Avatar } from '../../components/ui.jsx'
import NotificationBell from '../../components/NotificationBell.jsx'
import AppMenu from '../../components/AppMenu.jsx'
import { BagIcon, ChatIcon, ReceiptIcon, UserIcon } from '../../components/Icons.jsx'
import { fetchApplications } from '../../lib/db.js'
import { useLive } from '../../lib/live.js'
import Applications from './Applications.jsx'
import Sales from './Sales.jsx'
import CatalogueAdmin from './CatalogueAdmin.jsx'
import AdminChat from './AdminChat.jsx'
import DangerZone from './DangerZone.jsx'
import PushCard from '../../components/PushCard.jsx'

// The reset tool wipes every order, invoice and chat. It stays off on the
// live site unless VITE_TEST_TOOLS is turned on.
const showTestTools = import.meta.env.DEV || import.meta.env.VITE_TEST_TOOLS === 'on'

const TABS = [
  { value: 'apps', label: 'Applications', Icon: UserIcon },
  { value: 'sales', label: 'Sales', Icon: ReceiptIcon },
  { value: 'catalogue', label: 'Catalogue', Icon: BagIcon },
  { value: 'chat', label: 'Chat', Icon: ChatIcon },
]

export default function Admin() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const scrollRef = useRef(null)
  const { data: people } = useLive(fetchApplications, ['profiles'], [])
  const pending = (people || []).filter(p => p.status === 'pending').length
  const requested = params.get('tab')
  const tab = TABS.some(t => t.value === requested) ? requested : 'apps'

  const select = value => {
    const next = value === 'apps' ? {} : { tab: value }
    setParams(next, { replace: true })
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  return (
    <div className="screen">
      <div ref={scrollRef} className="scroll page stack gap-18 pb-24">
        <header className="row between start gap-12">
          <div>
            <p className="kicker sage mb-2">Admin console</p>
            <h2 className="title">Royal Tiara</h2>
          </div>
          <div className="row center gap-10">
            <NotificationBell />
            <AppMenu />
          </div>
        </header>

        <section className="card-dark">
          <div className="kicker on-dark">Signed in as</div>
          <div className="admin-name">{user.name}</div>
          <div className="accent-line">Admin controller &middot; manages accounts &amp; payments</div>
        </section>

        <PushCard audience="admin" />

        {tab === 'apps' && <Applications />}
        {tab === 'sales' && <Sales />}
        {tab === 'catalogue' && <CatalogueAdmin />}
        {tab === 'chat' && <AdminChat />}

        {showTestTools && <DangerZone />}

        <button type="button" className="btn btn-outline btn-50" onClick={signOut}>Sign out</button>
      </div>

      <nav className="tabbar" aria-label="Admin sections">
        {TABS.map(({ value, label, Icon }) => {
          const active = value === tab
          const badge = value === 'apps' ? pending : 0
          return (
            <button
              key={value}
              type="button"
              className={'tab ' + (active ? 'active' : '')}
              aria-current={active ? 'page' : undefined}
              onClick={() => select(value)}
            >
              <span className="tab-icon">
                <Icon />
                {badge > 0 && <span className="tab-badge">{badge > 99 ? '99+' : badge}</span>}
              </span>
              {label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
