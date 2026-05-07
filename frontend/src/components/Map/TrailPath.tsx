import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'
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

function formatTooltip(cluster: Cluster): string {
  const first = cluster.locations[0]
  if (cluster.locations.length === 1) {
    const time = new Date(first.timestamp).toLocaleString('pt-BR')
    return first.address ? `${time} · ${first.address}` : time
  }
  const last = cluster.locations[cluster.locations.length - 1]
  const start = new Date(first.timestamp).toLocaleString('pt-BR')
  const end = new Date(last.timestamp).toLocaleString('pt-BR')
  return `${start} → ${end} · ${cluster.locations.length} pontos`
}

export function TrailPath({ locations, focusedId, onPointClick }: TrailPathProps) {
  if (locations.length === 0) return null

  const clusters = clusterLocations(locations, CLUSTER_THRESHOLD_M)
  const lastIdx = clusters.length - 1

  return (
    <>
      {/* Segmentos de polyline com gradiente temporal frio → quente */}
      {clusters.slice(0, -1).map((c, i) => {
        const next = clusters[i + 1]
        const t = lastIdx > 0 ? (i + 0.5) / lastIdx : 0
        return (
          <Polyline
            key={`seg-${c.locations[0].id}`}
            positions={[
              [c.latitude, c.longitude],
              [next.latitude, next.longitude],
            ]}
            color={gradientColor(t)}
            weight={4}
            opacity={0.85}
          />
        )
      })}

      {/* Marcadores de cluster (tamanho cresce com nº de pontos) */}
      {clusters.map((cluster, i) => {
        const isFirst = i === 0
        const isLast = i === lastIdx && lastIdx > 0
        const isFocused =
          focusedId != null && cluster.locations.some(l => l.id === focusedId)

        const baseRadius =
          isFirst || isLast
            ? 9
            : Math.min(8, 4 + Math.log2(cluster.locations.length + 1))
        const radius = isFocused ? baseRadius + 3 : baseRadius
        const fillColor = gradientColor(lastIdx > 0 ? i / lastIdx : 0)

        return (
          <CircleMarker
            key={cluster.locations[0].id}
            center={[cluster.latitude, cluster.longitude]}
            radius={radius}
            pathOptions={{
              color: '#fff',
              fillColor,
              fillOpacity: 1,
              weight: isFocused ? 3 : 2,
            }}
            eventHandlers={{ click: () => onPointClick?.(cluster.locations[0]) }}
          >
            <Tooltip>{formatTooltip(cluster)}</Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
