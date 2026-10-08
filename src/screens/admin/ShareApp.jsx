import { BackButton } from '../../components/ui.jsx'
import ShareAppCard from '../../components/ShareAppCard.jsx'

/** Admin: the QR code and link for inviting distributors, opened from the menu. */
export default function ShareApp() {
  return (
    <div className="screen">
      <div className="page-top row center gap-12">
        <BackButton to="/admin" />
        <h2 className="title-sm">Share the app</h2>
      </div>
      <div className="scroll px-22 pt-8 pb-24 stack gap-14">
        <ShareAppCard />
      </div>
    </div>
  )
}
