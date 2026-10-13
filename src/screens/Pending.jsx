import { Link } from 'react-router-dom'
import { signOut, useAuth } from '../lib/auth.jsx'
import { WHATSAPP_DISPLAY, waLink } from '../lib/format.js'

export default function Pending() {
  const { user } = useAuth()
  const declined = user && user.status === 'declined'

  return (
    <div className="screen">
      <div className="scroll page stack gap-18">
        <div className="signin-logo"><img className="logo-img logo-sm" src="/logo.webp" alt="Royal Tiara" width="640" height="351" /></div>

        <div className={declined ? 'card card-pad stack gap-12' : 'success-card stack gap-12'}>
          <h2 className="h3">{declined ? 'Application not approved' : 'Application under review'}</h2>
          <p className="success-text">
            {declined
              ? 'Royal Tiara could not approve this trade account. Chat to us if you think this is a mistake.'
              : 'Thanks ' + (user ? user.name.split(' ')[0] : '') + '! Royal Tiara reviews trade accounts within one working day. You will get a notification here as soon as you are approved.'}
          </p>
        </div>

        <div className="card card-pad stack gap-10">
          <div className="kicker muted">While you wait</div>
          <Link to="/chat" className="btn btn-primary">Chat to Royal Tiara</Link>
          <a className="btn btn-outline" href={waLink()} target="_blank" rel="noreferrer">
            WhatsApp {WHATSAPP_DISPLAY}
          </a>
        </div>

        <button type="button" className="btn btn-outline btn-50" onClick={signOut}>Sign out</button>

        <div className="row center gap-18 foot-links">
          <Link to="/privacy" className="link-inline">Privacy policy</Link>
          <Link to="/account/delete" className="link-danger">Delete my account</Link>
        </div>
      </div>
    </div>
  )
}
