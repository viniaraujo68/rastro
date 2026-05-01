import { useState, useEffect } from 'react'
import { getDevices } from '../lib/api'
import type { Device } from '../types'

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  return { devices, loading, error }
}
