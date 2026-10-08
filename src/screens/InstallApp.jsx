import { useAuth } from '../lib/auth.jsx'
import { BackButton } from '../components/ui.jsx'
import InstallCard from '../components/InstallCard.jsx'

/** "Install the app", opened from the menu by admins and distributors. */
export default function InstallApp() {
  const { user } = useAuth()

  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to={user.role === 'admin' ? '/admin' : '/home'} />
        <h2 className="title-sm">Install the app</h2>
      </div>
      <div className="scroll px-22 pt-8 pb-24 stack gap-14">
        <InstallCard onScreen />
      </div>
    </div>
  )
}
