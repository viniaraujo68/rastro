import { useEffect, useRef, useState, type ReactNode } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'

/** Par [latitude, longitude] — mantém a ordem usada no resto do app. */
export type LatLng = [number, number]

const DEFAULT_CENTER: LatLng = [-22.9068, -43.1729]
const DEFAULT_ZOOM = 12

// Estilo vetorial CARTO dark-matter: combina com a paleta navy do app,
// é gratuito e não exige API key.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

interface MapViewProps {
  center?: LatLng
  zoom?: number
  animate?: boolean
  children?: ReactNode
}

export function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, animate = false, children }: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [lat, lng] = center

  // Câmera controlada: replica o antigo MapController (setView com animação opcional).
  // Depende de `loaded` porque o center pode mudar antes de o mapa terminar de
  // inicializar (resposta rápida da API) — sem isso o jumpTo inicial se perde.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const target = { center: [lng, lat] as [number, number], zoom }
    if (animate) map.easeTo({ ...target, duration: 500 })
    else map.jumpTo(target)
  }, [lat, lng, zoom, animate, loaded])

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: lng, latitude: lat, zoom }}
      mapStyle={MAP_STYLE}
      onLoad={() => setLoaded(true)}
      style={{ width: '100%', height: '100%' }}
      maxZoom={19}
      dragRotate={false}
      touchPitch={false}
      attributionControl={{ compact: true }}
    >
      {children}
    </Map>
  )
}
