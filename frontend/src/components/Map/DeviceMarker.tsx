import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import type { Location } from '../../types'

const pulseIcon = L.divIcon({
  className: '',
  html: `<div class="device-marker">
    <div class="device-marker-ring"></div>
    <div class="device-marker-dot"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
})

interface DeviceMarkerProps {
  location: Location
  deviceName: string
}

export function DeviceMarker({ location, deviceName }: DeviceMarkerProps) {
  const ts = new Date(location.timestamp).toLocaleString('pt-BR')

  return (
    <Marker position={[location.latitude, location.longitude]} icon={pulseIcon}>
      <Popup>
        <div style={{ minWidth: 160 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>{deviceName}</strong>
          {location.address && (
            <span style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              {location.address}
            </span>
          )}
          <span style={{ display: 'block', fontSize: 12 }}>{ts}</span>
          {location.battery_level != null && (
            <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
              🔋 {location.battery_level}%
            </span>
          )}
          {location.speed != null && location.speed > 0 && (
            <span style={{ display: 'block', fontSize: 12 }}>
              {(location.speed * 3.6).toFixed(1)} km/h
            </span>
          )}
        </div>
      </Popup>
    </Marker>
  )
}
