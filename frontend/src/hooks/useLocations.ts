import { useState, useEffect, useCallback } from 'react'
import { getLatestLocation, getLocations } from '../lib/api'
import type { Location } from '../types'

export function useLatestLocation(deviceId: string | null, intervalMs = 30_000) {
  const [location, setLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!deviceId) return
    setLoading(true)
    getLatestLocation(deviceId)
      .then(r => { setLocation(r.location); setError(null) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [deviceId])

  useEffect(() => {
    setLocation(null)
    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => clearInterval(id)
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
    setLoading(true)
    getLocations(deviceId, from, to)
      .then(r => { setLocations(r.locations ?? []); setError(null) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [deviceId, from, to])

  return { locations, loading, error }
}
