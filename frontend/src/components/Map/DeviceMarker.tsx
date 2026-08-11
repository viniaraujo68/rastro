import { useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import type { Location } from '../../types'

interface DeviceMarkerProps {
  location: Location
  deviceName: string
}

export function DeviceMarker({ location, deviceName }: DeviceMarkerProps) {
  const [open, setOpen] = useState(false)
  const ts = new Date(location.timestamp).toLocaleString('pt-BR')

  return (
    <>
      <Marker
        longitude={location.longitude}
        latitude={location.latitude}
        anchor="center"
        onClick={e => { e.originalEvent.stopPropagation(); setOpen(o => !o) }}
      >
        <div className="device-marker">
          <div className="device-marker-ring" />
          <div className="device-marker-dot" />
        </div>
      </Marker>

      {open && (
        <Popup
          longitude={location.longitude}
          latitude={location.latitude}
          anchor="bottom"
          offset={16}
          closeButton={false}
          className="rastro-popup"
          onClose={() => setOpen(false)}
        >
          <div style={{ minWidth: 150 }}>
            <strong style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text)' }}>
              {deviceName}
            </strong>
            {location.address && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
                {location.address}
              </span>
            )}
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{ts}</span>
            {location.battery_level != null && (
              <span style={{ display: 'block', fontSize: 12, marginTop: 4, color: 'var(--text2)' }}>
                🔋 {location.battery_level}%
              </span>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}
