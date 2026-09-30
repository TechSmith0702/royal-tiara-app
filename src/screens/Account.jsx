import { Link, useSearchParams } from 'react-router-dom'
import { signOut, useAuth } from '../lib/auth.jsx'
import { fetchOrders } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { fmtMonthYear, waLink, WHATSAPP_DISPLAY } from '../lib/format.js'
import AddressCard from '../components/AddressCard.jsx'
import { ActiveDot, Avatar } from '../components/ui.jsx'
import TabBar from '../components/TabBar.jsx'
import AppMenu from '../components/AppMenu.jsx'

export default function Account() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const savedPassword = params.get('saved') === 'password'
  const { data: orders } = useLive(fetchOrders, ['orders'], [])
  const count = (orders || []).length

  return (
    <div className="screen">
      <div className="page-top row between center"><h2 className="title">Account</h2><AppMenu /></div>
      <div className="scroll px-22 pt-8 pb-18 stack gap-14">
        {savedPassword && <p className="form-note" role="status">Your new password is saved.</p>}
        <section className="profile-card">
          <Avatar name={user.name} size={58} />
          <div className="min0">
            <div className="profile-name">{user.name}</div>
            <div className="body-muted">Distributor</div>
            <div className="muted-sm ellipsis">{user.email}</div>
          </div>
        </section>

        <section className="card-dark stack gap-14">
          <div className="row between center">
            <div className="kicker on-dark">Membership</div>
            <ActiveDot />
          </div>
          <div>
            <div className="dark-title">Distributor</div>
            <div className="accent-line">Member since {fmtMonthYear(user.memberSince)}</div>
          </div>
        </section>

        <AddressCard user={user} title="Delivery address" />

        <nav className="menu">
          <Link to="/orders" className="menu-row">
            <span>Order history</span><span className="menu-val">{count}<span className="chev">&rsaquo;</span></span>
          </Link>
          <Link to="/invoices" className="menu-row">
            <span>Invoices</span><span className="menu-val">{count}<span className="chev">&rsaquo;</span></span>
          </Link>
          <Link to="/notifications" className="menu-row">
            <span>Notifications</span><span className="menu-val"><span className="chev">&rsaquo;</span></span>
          </Link>
          <Link to="/chat" className="menu-row">
            <span>Chat to Royal Tiara</span><span className="menu-val"><span className="chev">&rsaquo;</span></span>
          </Link>
          <a href={waLink()} target="_blank" rel="noreferrer" className="menu-row">
            <span>WhatsApp Royal Tiara</span>
            <span className="menu-val">{WHATSAPP_DISPLAY}<span className="chev">&rsaquo;</span></span>
          </a>
        </nav>

        <button type="button" className="btn btn-outline btn-50" onClick={signOut}>Sign out</button>
      </div>
      <TabBar />
    </div>
  )
}
