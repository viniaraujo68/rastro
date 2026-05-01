import { useEffect, type ReactNode } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'

const DEFAULT_CENTER: LatLngExpression = [-22.9068, -43.1729]
const DEFAULT_ZOOM = 12

function MapController({ center, zoom, animate }: { center: LatLngExpression; zoom: number; animate: boolean }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate, duration: animate ? 0.5 : 0 })
  }, [map, center, zoom, animate])
  return null
}

interface MapViewProps {
  center?: LatLngExpression
  zoom?: number
  animate?: boolean
  children?: ReactNode
}

export function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, animate = false, children }: MapViewProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <MapController center={center} zoom={zoom} animate={animate} />
      {children}
    </MapContainer>
  )
}
