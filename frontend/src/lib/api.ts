import { supabase } from './supabase'
import type { Device, DeviceWithKey, Location, Permission, ShareLink } from '../types'

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
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Devices
export const getDevices = () =>
  request<{ devices: Device[] }>('/devices').then(r => r.devices)

export const createDevice = (name: string) =>
  request<DeviceWithKey>('/devices', { method: 'POST', body: JSON.stringify({ name }) })

export const updateDevice = (id: string, name: string, is_active: boolean) =>
  request<Device>(`/devices/${id}`, { method: 'PUT', body: JSON.stringify({ name, is_active }) })

export const deleteDevice = async (id: string): Promise<void> => {
  const headers = await authHeaders()
  await fetch(`${BASE}/devices/${id}`, { method: 'DELETE', headers })
}

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

export const revokePermission = async (deviceId: string, userId: string): Promise<void> => {
  const headers = await authHeaders()
  await fetch(`${BASE}/devices/${deviceId}/permissions/${userId}`, { method: 'DELETE', headers })
}

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

// Share links
export const createShareLink = (deviceId: string, hours: number) =>
  request<{ share_link: ShareLink }>(`/devices/${deviceId}/share`, {
    method: 'POST',
    body: JSON.stringify({ hours }),
  }).then(r => r.share_link)

export const getShareLinks = (deviceId: string) =>
  request<{ share_links: ShareLink[] }>(`/devices/${deviceId}/share`).then(r => r.share_links ?? [])

export const revokeShareLink = async (token: string): Promise<void> => {
  const headers = await authHeaders()
  await fetch(`${BASE}/share/${token}`, { method: 'DELETE', headers })
}

// Public share endpoint — no auth
export const getSharedLocation = (token: string) =>
  fetch(`${BASE}/share/${token}`)
    .then(r => r.ok ? r.json() : r.json().then((b: { error?: string }) => Promise.reject(new Error(b.error ?? `HTTP ${r.status}`))))
    .then(r => r as { device: Pick<Device, 'id' | 'name'>; location: Location | null })
