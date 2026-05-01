import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import type { Location } from '../../types'

interface HeatmapLayerProps {
  locations: Location[]
}

export function HeatmapLayer({ locations }: HeatmapLayerProps) {
  const map = useMap()

  useEffect(() => {
    if (locations.length === 0) return

    const points = locations.map(
      l => [l.latitude, l.longitude, 1] as [number, number, number],
    )

    const heat = L.heatLayer(points, {
      radius: 45,
      blur: 30,
      maxZoom: 17,
      minOpacity: 0.4,
      gradient: { 0.1: '#60a5fa', 0.4: '#a78bfa', 0.75: '#f87171' },
    }).addTo(map)

    return () => { map.removeLayer(heat) }
  }, [map, locations])

  return null
}
