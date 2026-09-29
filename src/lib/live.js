import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

/**
 * Loads data once, then reloads whenever the given tables change in the
 * database. This is what makes orders, chat and notifications live.
 */
export function useLive(load, tables, deps) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  loadRef.current = load

  const refresh = useCallback(async () => {
    try {
      const next = await loadRef.current()
      setData(next)
      setError(null)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    refresh()

    const watched = tables || []
    if (!watched.length) return () => { alive = false }

    const name = 'live-' + watched.join('-') + '-' + Math.random().toString(36).slice(2)
    const channel = supabase.channel(name)
    watched.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (alive) refresh()
      })
    })
    channel.subscribe()

    return () => { alive = false; supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps || [])

  return { data, loading, error, refresh }
}
