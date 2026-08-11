import { useEffect, useMemo, useRef, useState } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { Location } from '../../types'

interface TrailPathProps {
  locations: Location[]
  focusedId?: number | null
  onPointClick?: (location: Location) => void
}

// Threshold para agrupar pontos consecutivos. ~25m absorve ruído típico
// de GPS urbano (10-25m) sem fundir destinos próximos como mercado/loja
// na mesma rua (geralmente >50m).
const CLUSTER_THRESHOLD_M = 25

// Stops do gradiente temporal (frio → quente).
const COOL: [number, number, number] = [59, 130, 246]   // #3b82f6
const MID:  [number, number, number] = [168, 85, 247]   // #a855f7
const WARM: [number, number, number] = [248, 113, 113]  // #f87171

const LINE_LAYER_ID = 'rastro-trail-line'
const POINTS_LAYER_ID = 'rastro-trail-points'

interface Cluster {
  latitude: number
  longitude: number
  locations: Location[]
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function clusterLocations(locations: Location[], thresholdM: number): Cluster[] {
  if (locations.length === 0) return []

  const clusters: Cluster[] = []
  let cur: Location[] = [locations[0]]
  let sumLat = locations[0].latitude
  let sumLng = locations[0].longitude

  for (let i = 1; i < locations.length; i++) {
    const loc = locations[i]
    const cx = sumLat / cur.length
    const cy = sumLng / cur.length
    const d = distanceMeters(cx, cy, loc.latitude, loc.longitude)
    if (d < thresholdM) {
      cur.push(loc)
      sumLat += loc.latitude
      sumLng += loc.longitude
    } else {
      clusters.push({ latitude: cx, longitude: cy, locations: cur })
      cur = [loc]
      sumLat = loc.latitude
      sumLng = loc.longitude
    }
  }
  clusters.push({
    latitude: sumLat / cur.length,
    longitude: sumLng / cur.length,
    locations: cur,
  })

  return clusters
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function gradientColor(t: number): string {
  const tt = Math.max(0, Math.min(1, t))
  let r: number, g: number, b: number
  if (tt < 0.5) {
    const k = tt * 2
    r = lerp(COOL[0], MID[0], k)
    g = lerp(COOL[1], MID[1], k)
    b = lerp(COOL[2], MID[2], k)
  } else {
    const k = (tt - 0.5) * 2
    r = lerp(MID[0], WARM[0], k)
    g = lerp(MID[1], WARM[1], k)
    b = lerp(MID[2], WARM[2], k)
  }
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 1) return 'menos de 1min'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${h}h`
}

interface ClusterSummary {
  title: string
  detail?: string
  battery?: string
  address?: string
}

// Bateria na chegada → na saída; uma leitura só quando não variou (ou só
// existe em uma das pontas).
function batteryRange(first: Location, last: Location): string | undefined {
  const a = first.battery_level
  const b = last.battery_level
  if (a == null && b == null) return undefined
  if (a != null && b != null && a !== b) return `🔋 ${a}% → ${b}%`
  return `🔋 ${a ?? b}%`
}

function summarize(cluster: Cluster): ClusterSummary {
  const first = cluster.locations[0]
  const last = cluster.locations[cluster.locations.length - 1]
  const address = first.address ?? last.address

  if (cluster.locations.length === 1) {
    return {
      title: formatDateTime(new Date(first.timestamp)),
      battery: batteryRange(first, first),
      address,
    }
  }

  const start = new Date(first.timestamp)
  const end = new Date(last.timestamp)
  const fmt = sameDay(start, end) ? formatClock : formatDateTime
  const duration = formatDuration(end.getTime() - start.getTime())

  return {
    title: `${fmt(start)} → ${fmt(end)}`,
    detail: `${duration} de permanência · ${cluster.locations.length} pontos`,
    battery: batteryRange(first, last),
    address,
  }
}

export function TrailPath({ locations, focusedId, onPointClick }: TrailPathProps) {
  const { current: map } = useMap()
  const [hovered, setHovered] = useState<number | null>(null)

  const clusters = useMemo(
    () => clusterLocations(locations, CLUSTER_THRESHOLD_M),
    [locations],
  )
  const clustersRef = useRef(clusters)
  clustersRef.current = clusters

  const onPointClickRef = useRef(onPointClick)
  onPointClickRef.current = onPointClick

  const lastIdx = clusters.length - 1

  const lineData = useMemo<Feature<LineString>>(() => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: clusters.map(c => [c.longitude, c.latitude]),
    },
    properties: {},
  }), [clusters])

  const pointsData = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: clusters.map((cluster, i) => {
      const isEdge = i === 0 || (i === lastIdx && lastIdx > 0)
      const isFocused = focusedId != null && cluster.locations.some(l => l.id === focusedId)
      const baseRadius = isEdge ? 9 : Math.min(8, 4 + Math.log2(cluster.locations.length + 1))
      return {
        type: 'Feature' as const,
        id: i,
        geometry: { type: 'Point' as const, coordinates: [cluster.longitude, cluster.latitude] },
        properties: {
          idx: i,
          color: gradientColor(lastIdx > 0 ? i / lastIdx : 0),
          radius: isFocused ? baseRadius + 3 : baseRadius,
          strokeWidth: isFocused ? 3 : 2,
        },
      }
    }),
  }), [clusters, lastIdx, focusedId])

  // Interação: hover mostra o resumo do cluster, clique foca o ponto.
  useEffect(() => {
    if (!map) return

    const canvas = map.getCanvas()

    const handleMove = (e: MapLayerMouseEvent) => {
      const idx = e.features?.[0]?.properties?.idx
      if (typeof idx === 'number') {
        canvas.style.cursor = 'pointer'
        setHovered(idx)
      }
    }
    const handleLeave = () => {
      canvas.style.cursor = ''
      setHovered(null)
    }
    const handleClick = (e: MapLayerMouseEvent) => {
      const idx = e.features?.[0]?.properties?.idx
      if (typeof idx !== 'number') return
      const cluster = clustersRef.current[idx]
      if (!cluster) return
      setHovered(idx)
      onPointClickRef.current?.(cluster.locations[0])
    }

    map.on('mousemove', POINTS_LAYER_ID, handleMove)
    map.on('mouseleave', POINTS_LAYER_ID, handleLeave)
    map.on('click', POINTS_LAYER_ID, handleClick)

    return () => {
      map.off('mousemove', POINTS_LAYER_ID, handleMove)
      map.off('mouseleave', POINTS_LAYER_ID, handleLeave)
      map.off('click', POINTS_LAYER_ID, handleClick)
      canvas.style.cursor = ''
    }
  }, [map])

  useEffect(() => { setHovered(null) }, [clusters])

  if (locations.length === 0) return null

  const hoveredCluster = hovered != null ? clusters[hovered] : null
  const summary = hoveredCluster ? summarize(hoveredCluster) : null

  return (
    <>
      {/* Linha do trajeto com gradiente temporal contínuo (frio → quente) */}
      {clusters.length > 1 && (
        <Source id="rastro-trail" type="geojson" data={lineData} lineMetrics>
          <Layer
            id={LINE_LAYER_ID}
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 5],
              'line-opacity': 0.9,
              'line-gradient': [
                'interpolate',
                ['linear'],
                ['line-progress'],
                0, '#3b82f6',
                0.5, '#a855f7',
                1, '#f87171',
              ],
            }}
          />
        </Source>
      )}

      {/* Marcadores de cluster (tamanho cresce com nº de pontos) */}
      <Source id="rastro-trail-points" type="geojson" data={pointsData}>
        <Layer
          id={POINTS_LAYER_ID}
          type="circle"
          paint={{
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': ['get', 'strokeWidth'],
          }}
        />
      </Source>

      {hoveredCluster && summary && (
        <Popup
          longitude={hoveredCluster.longitude}
          latitude={hoveredCluster.latitude}
          anchor="bottom"
          offset={16}
          closeButton={false}
          closeOnClick={false}
          className="rastro-popup"
          onClose={() => setHovered(null)}
        >
          <div style={{ maxWidth: 220 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {summary.title}
            </span>
            {summary.detail && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
                {summary.detail}
              </span>
            )}
            {summary.battery && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
                {summary.battery}
              </span>
            )}
            {summary.address && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>
                {summary.address}
              </span>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}
