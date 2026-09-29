import { Link } from 'react-router-dom'
import { fetchOrders } from '../lib/db.js'
import { useLive } from '../lib/live.js'
import { fmtDate, pluralise, R } from '../lib/format.js'
import { orderState, unitsIn } from '../lib/orders.js'
import { ErrorNote, Loading, StatusChip } from '../components/ui.jsx'
import TabBar from '../components/TabBar.jsx'
import AppMenu from '../components/AppMenu.jsx'

export default function Orders() {
  const { data: orders, loading, error, refresh } = useLive(fetchOrders, ['orders'], [])

  return (
    <div className="screen">
      <div className="page-top row between center"><h2 className="title">Orders</h2><AppMenu /></div>
      <div className="scroll list pt-8">
        {loading && <Loading label="Loading your orders..." />}
        <ErrorNote message={error} onRetry={refresh} />

        {!loading && !error && (orders || []).length === 0 && (
          <div className="empty-card mt-6">
            <h3 className="h3-sm">No orders yet</h3>
            <p>Your orders will show here once you check out.</p>
            <Link to="/shop" className="btn btn-primary btn-md btn-inline">Browse catalogue</Link>
          </div>
        )}

        {(orders || []).map(o => {
          const st = orderState(o)
          return (
            <Link key={o.id} to={'/orders/' + o.id} className="order-card">
              <div className="row between center gap-10">
                <span className="order-id">{o.id}</span>
                <StatusChip tone={st.tone}>{st.status}</StatusChip>
              </div>
              <div className="order-meta">
                {fmtDate(o.createdAt)} &middot; {pluralise(o.lines.length, 'line')} &middot; {pluralise(unitsIn(o), 'unit')}
              </div>
              <div className="row between center">
                <span className="order-total">{R(o.total)}</span>
                <span className="order-cta">{st.hasProof ? 'Track' : 'Upload proof'} &rsaquo;</span>
              </div>
            </Link>
          )
        })}
      </div>
      <TabBar />
    </div>
  )
}
