import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { attachProof, fetchOrders } from '../lib/db.js'
import { uploadProof } from '../lib/files.js'
import { useLive } from '../lib/live.js'
import { fmtDate, R } from '../lib/format.js'
import { orderState } from '../lib/orders.js'
import { ErrorNote, FilePicker, Loading, StatusChip } from '../components/ui.jsx'
import TabBar from '../components/TabBar.jsx'
import AppMenu from '../components/AppMenu.jsx'

export default function Invoices() {
  const { user } = useAuth()
  const { data: orders, loading, error, refresh } = useLive(fetchOrders, ['orders'], [])
  const [problem, setProblem] = useState('')

  const list = orders || []
  const unpaid = list.filter(o => o.payStatus !== 'verified')
  const outstanding = unpaid.reduce((t, o) => t + o.total, 0)

  const attachTo = orderId => async file => {
    setProblem('')
    try {
      const stored = await uploadProof(user.id, file)
      await attachProof(orderId, stored)
      refresh()
    } catch (e) {
      setProblem(e.message)
      throw e
    }
  }

  return (
    <div className="screen">
      <div className="page-top row between center"><h2 className="title">Invoices</h2><AppMenu /></div>
      <div className="scroll list pt-8 gap-12">
        {loading && <Loading label="Loading invoices..." />}
        <ErrorNote message={error} onRetry={refresh} />
        {problem && <p className="form-error" role="alert">{problem}</p>}

        {!loading && !error && list.length === 0 && (
          <div className="empty-card mt-6">
            <h3 className="h3-sm">No invoices yet</h3>
            <p className="mb-0">An invoice is issued for every order you place.</p>
          </div>
        )}

        {list.length > 0 && (
          <div className="outstanding">
            <div>
              <div className="kicker muted">Awaiting payment</div>
              <div className="outstanding-value">{R(outstanding)}</div>
            </div>
            <span className="pill-peach">{unpaid.length === 0 ? 'All paid' : unpaid.length + ' unpaid'}</span>
          </div>
        )}

        {list.map(o => {
          const st = orderState(o)
          return (
            <div key={o.id} className="invoice-card">
              <div className="row between center gap-10">
                <span className="invoice-id">{o.invoice}</span>
                <StatusChip tone={st.invoice.tone}>{st.invoice.label}</StatusChip>
              </div>
              <div className="row between center">
                <span className="order-meta">{fmtDate(o.createdAt)} &middot; {o.id}</span>
                <span className="order-total">{R(o.total)}</span>
              </div>
              <div className="row gap-9">
                <Link to={'/invoices/' + o.id} className="btn btn-outline btn-44 grow">Download PDF</Link>
                {!st.hasProof && (
                  <FilePicker className="btn btn-primary btn-44 grow" onPicked={attachTo(o.id)}>
                    Upload proof
                  </FilePicker>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <TabBar />
    </div>
  )
}
