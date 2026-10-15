import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * An in-page replacement for window.confirm, which some in-app browsers block
 * (the tap then silently does nothing). Usage:
 *
 *   const [ask, dialog] = useConfirm()
 *   if (!(await ask({ title: 'Delete it?', body: '...', yes: 'Delete', danger: true }))) return
 *   ...and render {dialog} somewhere in the component.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const resolver = useRef(null)

  const ask = useCallback(options => new Promise(resolve => {
    resolver.current = resolve
    setRequest(options)
  }), [])

  const answer = useCallback(value => {
    setRequest(null)
    if (resolver.current) resolver.current(value)
    resolver.current = null
  }, [])

  // A dialog left open when the screen changes counts as "no".
  useEffect(() => () => { if (resolver.current) resolver.current(false) }, [])

  const dialog = request ? <ConfirmDialog {...request} onAnswer={answer} /> : null
  return [ask, dialog]
}

function ConfirmDialog({ title, body, yes = 'Yes', no = 'Cancel', danger = false, onAnswer }) {
  const yesRef = useRef(null)

  useEffect(() => {
    yesRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onAnswer(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAnswer])

  return (
    <div className="confirm-backdrop" onClick={() => onAnswer(false)}>
      <div
        className="confirm-box stack gap-12"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <strong className="confirm-title">{title}</strong>
        {body && <p className="body-muted mb-0">{body}</p>}
        <div className="row gap-10">
          <button type="button" className="btn btn-outline btn-46 grow" onClick={() => onAnswer(false)}>{no}</button>
          <button
            ref={yesRef}
            type="button"
            className={'btn btn-46 grow ' + (danger ? 'btn-danger' : 'btn-primary')}
            onClick={() => onAnswer(true)}
          >
            {yes}
          </button>
        </div>
      </div>
    </div>
  )
}
