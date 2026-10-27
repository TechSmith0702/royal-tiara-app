import { Link } from 'react-router-dom'
import { FEATURED_IDS } from '../data/products.js'
import { useAuth } from '../lib/auth.jsx'
import { fetchActiveProducts, fetchOrders, priceLabel } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { greeting, pluralise, R, waLink } from '../lib/format.js'
import { isOpen } from '../lib/orders.js'
import { ActiveDot, Avatar, ErrorNote, Loading, ProductImage } from '../components/ui.jsx'
import NotificationBell from '../components/NotificationBell.jsx'
import TabBar from '../components/TabBar.jsx'
import AppMenu from '../components/AppMenu.jsx'

export default function Home() {
  const { user } = useAuth()
  const { data: products, loading, error, refresh } = useLive(fetchActiveProducts, ['products'], [])
  const { data: orders } = useLive(fetchOrders, ['orders'], [])

  const mine = orders || []
  const today = new Date()
  // Only paid orders count as spent; unpaid ones show under open orders.
  const thisMonth = mine.filter(o => {
    const d = new Date(o.createdAt)
    return o.payStatus === 'verified' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  })
  const spend = thisMonth.reduce((t, o) => t + o.total, 0)
  const open = mine.filter(isOpen)
  const unpaid = open.filter(o => o.payStatus !== 'verified').length
  // The admin picks these in Catalogue. Until the database knows about "Moving
  // fast" (featuredRank undefined), the built-in four are shown.
  const all = products || []
  const featured = all.some(p => p.featuredRank !== undefined)
    ? all.filter(p => p.featuredRank != null).sort((a, b) => a.featuredRank - b.featuredRank)
    : FEATURED_IDS.map(id => all.find(p => p.id === id)).filter(Boolean)

  return (
    <div className="screen">
      <div className="scroll page stack gap-18">
        <header className="row between start gap-12">
          <div>
            <p className="greet">{greeting()}, {user.name.split(' ')[0]}</p>
            <h2 className="title">{user.business || user.name}</h2>
          </div>
          <div className="row center gap-10">
            <NotificationBell />
            <AppMenu />
          </div>
        </header>

        {user.credit > 0 && (
          <section className="credit-card">
            <div className="kicker">Amount payable to you</div>
            <div className="credit-value">{R(user.credit)}</div>
            <div className="muted-sm">Comes off your next order automatically.</div>
          </section>
        )}

        <section className="card-dark stack gap-14">
          <div className="row between center">
            <span className="kicker on-dark">Trade account</span>
            <ActiveDot />
          </div>
          <div className="row between end gap-14">
            <div>
              <div className="dark-title">Distributor</div>
              <div className="accent-line">Ordering at wholesale prices</div>
            </div>
            <Link to="/account" className="btn-ghost-dark">Account</Link>
          </div>
        </section>

        <div className="row gap-12">
          <div className="stat stat-plain grow">
            <div className="kicker muted">This month</div>
            <div className="stat-value">{R(spend)}</div>
            <div className="stat-sub">{pluralise(thisMonth.length, 'order')} paid</div>
          </div>
          <div className="stat stat-sage grow">
            <div className="kicker">Open orders</div>
            <div className="stat-value">{open.length}</div>
            <div className="stat-sub">{unpaid ? unpaid + ' awaiting payment' : 'in progress'}</div>
          </div>
        </div>

        <Link to="/chat" className="wa-banner">
          <span className="wa-icon" aria-hidden="true">&#9993;</span>
          <span className="grow">
            <span className="wa-title">Chat to Royal Tiara</span>
            <span className="wa-sub">Ask about stock, orders or delivery</span>
          </span>
          <span className="chev">&rsaquo;</span>
        </Link>

        <a className="wa-banner wa-banner-soft" href={waLink('Hi Royal Tiara, I would like to place a distributor order:')} target="_blank" rel="noreferrer">
          <span className="wa-icon sage" aria-hidden="true">&#9742;</span>
          <span className="grow">
            <span className="wa-title">Order on WhatsApp</span>
            <span className="wa-sub">Send your list, we build the cart</span>
          </span>
          <span className="chev">&rsaquo;</span>
        </a>

        <div className="row between center mt-2">
          <h3 className="section-title">{featured.length || loading ? 'Moving fast' : 'Catalogue'}</h3>
          <Link to="/shop" className="link-btn">See all {(products || []).length}</Link>
        </div>

        {loading && <Loading label="Loading products..." />}
        <ErrorNote message={error} onRetry={refresh} />

        {featured.length > 0 && <div className="carousel">
          {featured.map(p => (
            <Link key={p.id} to={'/shop/' + p.id} className="feature-card">
              <ProductImage product={p} className="feature-img" initialSize={26} />
              <div className="feature-name">{p.name}</div>
              <div className="feature-price">{priceLabel(p)}</div>
            </Link>
          ))}
        </div>}
      </div>
      <TabBar />
    </div>
  )
}
