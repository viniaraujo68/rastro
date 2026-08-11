import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection, Point } from 'geojson'
import type { Location } from '../../types'

interface HeatmapLayerProps {
  locations: Location[]
}

export function HeatmapLayer({ locations }: HeatmapLayerProps) {
  const data = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: locations.map(l => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [l.longitude, l.latitude] },
      properties: {},
    })),
  }), [locations])

  if (locations.length === 0) return null

  return (
    <Source id="rastro-heat" type="geojson" data={data}>
      <Layer
        id="rastro-heat-layer"
        type="heatmap"
        paint={{
          'heatmap-weight': 1,
          // Densidade aparente cresce com o zoom para não "borrar" a cidade toda.
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 12, 1.2, 17, 3],
          // Gradiente frio → quente calibrado para basemap escuro.
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(7,16,31,0)',
            0.1, 'rgba(59,127,245,0.55)',
            0.3, '#60a5fa',
            0.55, '#a78bfa',
            0.78, '#c084fc',
            1, '#f87171',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 12, 28, 17, 55],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.75, 17, 0.9],
        }}
      />
    </Source>
  )
}
