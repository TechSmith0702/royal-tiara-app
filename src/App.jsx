import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import { resumePush } from './lib/push.js'
import { isSupabaseConfigured } from './lib/supabase.js'
import SignIn from './screens/SignIn.jsx'
import Apply from './screens/Apply.jsx'
import NewPassword from './screens/NewPassword.jsx'
import Pending from './screens/Pending.jsx'
import Home from './screens/Home.jsx'
import Catalogue from './screens/Catalogue.jsx'
import Product from './screens/Product.jsx'
import Cart from './screens/Cart.jsx'
import Checkout from './screens/Checkout.jsx'
import Success from './screens/Success.jsx'
import Orders from './screens/Orders.jsx'
import OrderDetail from './screens/OrderDetail.jsx'
import Invoices from './screens/Invoices.jsx'
import InvoiceView from './screens/InvoiceView.jsx'
import Account from './screens/Account.jsx'
import Chat from './screens/Chat.jsx'
import Notifications from './screens/Notifications.jsx'
import PaymentReturn from './screens/PaymentReturn.jsx'
import Admin from './screens/admin/Admin.jsx'
import Person from './screens/admin/Person.jsx'
import ProductEditor from './screens/admin/ProductEditor.jsx'
import InstallApp from './screens/InstallApp.jsx'
import DeleteAccount from './screens/DeleteAccount.jsx'
import Privacy, { DeleteAccountHelp } from './screens/Privacy.jsx'

const homeFor = user => {
  if (!user) return '/signin'
  if (user.role === 'admin') return '/admin'
  return user.status === 'approved' ? '/home' : '/pending'
}

// Shown while signing in is checked. It matches Android's own splash screen for
// the installed app (the logo on cream), so one flows into the other.
function Splash() {
  return (
    <div className="screen splash" role="status" aria-label="Loading Royal Tiara">
      <img className="logo-img logo-splash" src="/logo.webp" alt="Royal Tiara" width="640" height="351" />
      <span className="spinner" aria-hidden="true" />
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="screen splash">
      <img className="logo-img logo-sm" src="/logo.webp" alt="Royal Tiara" width="640" height="351" />
      <h2 className="title">Not connected yet</h2>
      <p className="lede center">
        Add your Supabase project URL and publishable key to the .env file, then restart the app.
      </p>
    </div>
  )
}

function RequireDistributor() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/signin" replace />
  if (user.role !== 'distributor' || user.status !== 'approved') return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/signin" replace />
  if (user.role !== 'admin') return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

function RequireSignedIn() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/signin" replace />
  return <Outlet />
}

export default function App() {
  const { user, ready } = useAuth()
  const userId = user ? user.id : null

  // A phone that already allows notifications is linked to whoever signs in.
  useEffect(() => {
    if (userId) resumePush().catch(() => {})
  }, [userId])

  if (!isSupabaseConfigured) return <div className="app"><NotConfigured /></div>
  if (!ready) return <div className="app"><Splash /></div>

  const home = homeFor(user)

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/signin" element={user ? <Navigate to={home} replace /> : <SignIn />} />
        <Route path="/apply" element={user ? <Navigate to={home} replace /> : <Apply />} />
        <Route path="/new-password" element={<NewPassword />} />
        {/* Public: the app stores and new applicants open these without signing in. */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/delete-account" element={<DeleteAccountHelp />} />
        <Route path="/pending" element={user ? <Pending /> : <Navigate to="/signin" replace />} />

        <Route element={<RequireSignedIn />}>
          {/* Admins use the Chat tab in the console, not a personal chat thread. */}
          <Route
            path="/chat"
            element={user && user.role === 'admin' ? <Navigate to="/admin?tab=chat" replace /> : <Chat />}
          />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/install" element={<InstallApp />} />
          <Route path="/account/delete" element={<DeleteAccount />} />
        </Route>

        <Route element={<RequireDistributor />}>
          <Route path="/home" element={<Home />} />
          <Route path="/shop" element={<Catalogue />} />
          <Route path="/shop/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/success/:id" element={<Success />} />
          <Route path="/payment/return" element={<PaymentReturn outcome="return" />} />
          <Route path="/payment/cancel" element={<PaymentReturn outcome="cancel" />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceView />} />
          <Route path="/account" element={<Account />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/product/:id" element={<ProductEditor />} />
          <Route path="/admin/person/:id" element={<Person />} />
        </Route>

        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </div>
  )
}
