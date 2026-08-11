import { useState, useEffect, useCallback, useRef } from 'react'
import { getLatestLocation, getLocations } from '../lib/api'
import type { Location } from '../types'

export function useLatestLocation(deviceId: string | null, intervalMs = 30_000) {
  const [location, setLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Monotonic id of the most recent request; older in-flight responses are discarded.
  const requestId = useRef(0)

  const fetch = useCallback(() => {
    if (!deviceId) return
    const id = ++requestId.current
    const isStale = () => id !== requestId.current
    setLoading(true)
    getLatestLocation(deviceId)
      .then(r => { if (isStale()) return; setLocation(r.location); setError(null) })
      .catch(e => { if (isStale()) return; setError((e as Error).message) })
      .finally(() => { if (!isStale()) setLoading(false) })
  }, [deviceId])

  useEffect(() => {
    setLocation(null)
    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => {
      // Invalidate anything still in flight for the previous device/interval.
      requestId.current++
      clearInterval(id)
    }
  }, [fetch, intervalMs])

  return { location, loading, error, refresh: fetch }
}

export function useLocationHistory(
  deviceId: string | null,
  from: string | undefined,
  to: string | undefined,
) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!deviceId) return
    let cancelled = false
    setLoading(true)
    getLocations(deviceId, from, to)
      .then(r => { if (cancelled) return; setLocations(r.locations ?? []); setError(null) })
      .catch(e => { if (cancelled) return; setError((e as Error).message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [deviceId, from, to])

  return { locations, loading, error }
}
