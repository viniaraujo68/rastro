import { supabase } from './supabase'
import type { Device, DeviceWithKey, Location, Permission } from '../types'

const BASE = import.meta.env.VITE_API_URL as string

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...init?.headers } })
  // 204 / empty bodies are valid responses (DELETE), so read as text and parse only if present.
  const text = await res.text()
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = JSON.parse(text) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // non-JSON error body: keep the status message
    }
    throw new Error(message)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

// Devices
export const getDevices = () =>
  request<{ devices: Device[] }>('/devices').then(r => r.devices)

export const createDevice = (name: string) =>
  request<DeviceWithKey>('/devices', { method: 'POST', body: JSON.stringify({ name }) })

export const updateDevice = (id: string, name: string, is_active: boolean) =>
  request<Device>(`/devices/${id}`, { method: 'PUT', body: JSON.stringify({ name, is_active }) })

export const deleteDevice = (id: string): Promise<void> =>
  request<void>(`/devices/${id}`, { method: 'DELETE' })

export const rotateKey = (id: string) =>
  request<{ device_id: string; api_key: string }>(`/devices/${id}/rotate-key`, { method: 'POST' })

// Permissions
export const getPermissions = (deviceId: string) =>
  request<{ permissions: Permission[] }>(`/devices/${deviceId}/permissions`).then(r => r.permissions)

export const grantPermission = (deviceId: string, email: string, permission: 'view' | 'admin') =>
  request<Permission>(`/devices/${deviceId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  })

export const revokePermission = (deviceId: string, userId: string): Promise<void> =>
  request<void>(`/devices/${deviceId}/permissions/${userId}`, { method: 'DELETE' })

// Locations
export const getLocations = (deviceId: string, from?: string, to?: string, limit = 1000) => {
  const params = new URLSearchParams({ device_id: deviceId, limit: String(limit) })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return request<{
    device: Pick<Device, 'id' | 'name'>
    locations: Location[]
    meta: { count: number; from: string; to: string }
  }>(`/locations?${params}`)
}

export const getLatestLocation = (deviceId: string) =>
  request<{ device: Pick<Device, 'id' | 'name'>; location: Location }>(
    `/locations/latest?device_id=${deviceId}`
  )
