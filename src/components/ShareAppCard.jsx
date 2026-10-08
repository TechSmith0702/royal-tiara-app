import { useEffect, useState } from 'react'
import { publicUrl } from '../lib/platform.js'

/**
 * Admin only: a QR code and link for inviting distributors to the app. They
 * open it, apply for a trade account and tap "Install the app".
 */
export default function ShareAppCard() {
  const url = publicUrl('/')
  const message = 'Order Royal Tiara hair care at distributor prices. Open the trade app and tap "Install the app": ' + url
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    // Loaded only here, so distributors never download the QR library.
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#201e1dff', light: '#ffffffff' } }),
      )
      .then(data => alive && setQr(data))
      .catch(() => {})
    return () => { alive = false }
  }, [url])

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Royal Tiara trade app', text: message })
        return
      } catch {
        // cancelled: fall through to copying
      }
    }
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // no clipboard access: the link is shown on screen to copy by hand
    }
  }

  return (
    <section className="card card-pad stack gap-12">
      <div className="kicker muted">Share the app</div>
      <p className="body-muted mb-0">
        New distributors scan this or open the link, apply for a trade account, then install the app.
      </p>

      <div className="qr-box">
        {qr ? <img src={qr} alt={'QR code for ' + url} width="200" height="200" /> : <span className="spinner" aria-hidden="true" />}
      </div>
      <div className="muted-sm qr-url">{url}</div>

      <div className="row gap-10">
        <a
          className="btn btn-outline btn-52 grow"
          href={'https://wa.me/?text=' + encodeURIComponent(message)}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
        <button type="button" className="btn btn-outline btn-52 grow" onClick={share}>
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>
      {qr && (
        <a className="btn btn-primary btn-52" href={qr} download="royal-tiara-app-qr.png">Download QR code</a>
      )}
    </section>
  )
}
