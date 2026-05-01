export interface Device {
  id: string
  owner_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
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
  accuracy?: number
  altitude?: number
  speed?: number
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

export interface ShareLink {
  id: string
  device_id: string
  created_by: string
  expires_at: string
  created_at: string
}

export type ViewMode = 'realtime' | 'trail' | 'heatmap'
