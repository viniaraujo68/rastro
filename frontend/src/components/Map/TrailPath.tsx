import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import type { Location } from '../../types'

interface TrailPathProps {
  locations: Location[]
  focusedId?: number | null
  onPointClick?: (location: Location) => void
}

function formatTooltip(loc: Location) {
  const time = new Date(loc.timestamp).toLocaleString('pt-BR')
  const parts = [time]
  if (loc.address) parts.push(loc.address)
  if (loc.speed != null && loc.speed > 0) parts.push(`${(loc.speed * 3.6).toFixed(1)} km/h`)
  return parts.join(' · ')
}

export function TrailPath({ locations, focusedId, onPointClick }: TrailPathProps) {
  if (locations.length === 0) return null

  const positions = locations.map(l => [l.latitude, l.longitude] as [number, number])
  const first = locations[0]
  const last = locations[locations.length - 1]

  return (
    <>
      <Polyline positions={positions} color="#2563eb" weight={3} opacity={0.7} />

      {/* Start marker — green */}
      <CircleMarker
        center={[first.latitude, first.longitude]}
        radius={8}
        pathOptions={{ color: '#fff', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}
        eventHandlers={{ click: () => onPointClick?.(first) }}
      >
        <Tooltip>Início · {new Date(first.timestamp).toLocaleString('pt-BR')}</Tooltip>
      </CircleMarker>

      {/* Intermediate points */}
      {locations.slice(1, -1).map(loc => (
        <CircleMarker
          key={loc.id}
          center={[loc.latitude, loc.longitude]}
          radius={focusedId === loc.id ? 7 : 4}
          pathOptions={{
            color: focusedId === loc.id ? '#fff' : '#2563eb',
            fillColor: focusedId === loc.id ? '#2563eb' : '#2563eb',
            fillOpacity: focusedId === loc.id ? 1 : 0.5,
            weight: focusedId === loc.id ? 2 : 1,
          }}
          eventHandlers={{ click: () => onPointClick?.(loc) }}
        >
          <Tooltip>{formatTooltip(loc)}</Tooltip>
        </CircleMarker>
      ))}

      {/* End marker — red */}
      {locations.length > 1 && (
        <CircleMarker
          center={[last.latitude, last.longitude]}
          radius={8}
          pathOptions={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}
          eventHandlers={{ click: () => onPointClick?.(last) }}
        >
          <Tooltip>Fim · {new Date(last.timestamp).toLocaleString('pt-BR')}</Tooltip>
        </CircleMarker>
      )}
    </>
  )
}
