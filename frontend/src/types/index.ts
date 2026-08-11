export interface Device {
  id: string
  owner_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
  /** ISO timestamp of the most recent location, when the API provides it. */
  last_seen?: string | null
}

export interface DeviceWithKey extends Device {
  api_key: string
}

export interface Location {
  id: number
  device_id: string
  latitude: number
  longitude: number
  address?: string
  altitude?: number
  battery_level?: number
  timestamp: string
  created_at: string
}

export interface Permission {
  id: string
  device_id: string
  user_id: string
  user_email: string
  permission: 'view' | 'admin'
  granted_by: string
  granted_at: string
}

export type ViewMode = 'realtime' | 'trail' | 'heatmap'
