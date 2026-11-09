import { useEffect, useState } from 'react'

/**
 * A strip at the top while the phone has no internet, so a failed load or
 * order makes sense. Opening the app with no internet shows /offline.html instead.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null
  return (
    <div className="offline-banner" role="status">
      You're offline. Check your mobile data or Wi-Fi.
    </div>
  )
}
