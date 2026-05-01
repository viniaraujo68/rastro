import { useState, useEffect, type ReactNode, type CSSProperties } from 'react'
import type { LatLngExpression } from 'leaflet'
import { MapView } from '../components/Map/MapView'
import { DeviceMarker } from '../components/Map/DeviceMarker'
import { TrailPath } from '../components/Map/TrailPath'
import { HeatmapLayer } from '../components/Map/HeatmapLayer'
import { buildRange } from '../components/Controls/DateRangePicker'
import type { DateRange } from '../components/Controls/DateRangePicker'
import { useDevices } from '../hooks/useDevices'
import { useLatestLocation, useLocationHistory } from '../hooks/useLocations'
import { useIsMobile } from '../hooks/useIsMobile'
import { Ico } from '../components/icons/Ico'
import type { Location, ViewMode } from '../types'

const RIO: LatLngExpression = [-22.9068, -43.1729]

function formatAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min atrás`
  return `${Math.floor(m / 60)}h atrás`
}

function haversineKm(a: Location, b: Location): number {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function totalDistanceKm(locs: Location[]): number {
  let sum = 0
  for (let i = 1; i < locs.length; i++) sum += haversineKm(locs[i - 1], locs[i])
  return sum
}

function formatDuration(from: string, to: string): string {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Local FloatingPill component
function FloatingPill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ ...pillStyle, ...style }}>
      {children}
    </div>
  )
}

const pillStyle: CSSProperties = {
  background: 'rgba(13,26,46,0.92)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--border2)',
  borderRadius: 99,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  pointerEvents: 'auto',
}

type DatePreset = 'today' | '24h' | '7d' | '30d'
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

export default function DashboardPage() {
  const isMobile = useIsMobile()
  const { devices, loading: devicesLoading } = useDevices()
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('realtime')
  const [datePreset, setDatePreset] = useState<DatePreset>('24h')
  const [dateRange, setDateRange] = useState<DateRange>(buildRange('24h'))
  const [focusedLocation, setFocusedLocation] = useState<Location | null>(null)
  const [stableCenter, setStableCenter] = useState<LatLngExpression | null>(null)
  const [animateMap, setAnimateMap] = useState(false)
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false)
  const [, setTick] = useState(0)

  const pollingInterval = Number(localStorage.getItem('rastro_polling_ms') || 30000)

  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].id)
    }
  }, [devices, selectedDeviceId])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { setFocusedLocation(null); setAnimateMap(false) }, [selectedDeviceId, viewMode])

  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset)
    setDateRange(buildRange(preset))
  }

  const { location: latestLocation, loading: latestLoading } = useLatestLocation(
    viewMode === 'realtime' ? selectedDeviceId : null,
    pollingInterval,
  )

  const { locations: trailLocations, loading: trailLoading } = useLocationHistory(
    viewMode !== 'realtime' ? selectedDeviceId : null,
    dateRange.from,
    dateRange.to,
  )

  useEffect(() => {
    if (latestLocation) setStableCenter([latestLocation.latitude, latestLocation.longitude])
  }, [latestLocation])

  useEffect(() => {
    if (trailLocations.length > 0) {
      const last = trailLocations[trailLocations.length - 1]
      setStableCenter([last.latitude, last.longitude])
    }
  }, [trailLocations])

  const selectedDevice = devices.find(d => d.id === selectedDeviceId)

  const mapCenter: LatLngExpression = focusedLocation
    ? [focusedLocation.latitude, focusedLocation.longitude]
    : stableCenter ?? RIO

  const mapZoom = stableCenter || focusedLocation ? 14 : 12

  function handleTimelineSelect(loc: Location) {
    setAnimateMap(true)
    setFocusedLocation(loc)
  }

  // Trail stats
  const trailDistance = totalDistanceKm(trailLocations)
  const trailDuration = trailLocations.length >= 2
    ? formatDuration(trailLocations[0].timestamp, trailLocations[trailLocations.length - 1].timestamp)
    : '--'
  const avgBattery = trailLocations.length > 0
    ? Math.round(trailLocations.filter(l => l.battery_level != null).reduce((a, l) => a + (l.battery_level ?? 0), 0) / Math.max(1, trailLocations.filter(l => l.battery_level != null).length))
    : null

  const VIEW_MODES: { value: ViewMode; label: string }[] = [
    { value: 'realtime', label: 'Ao vivo' },
    { value: 'trail', label: 'Trajeto' },
    { value: 'heatmap', label: 'Heatmap' },
  ]

  return (
    <div style={styles.root}>
      <MapView center={mapCenter} zoom={mapZoom} animate={animateMap}>
        {viewMode === 'realtime' && latestLocation && selectedDevice && (
          <DeviceMarker location={latestLocation} deviceName={selectedDevice.name} />
        )}
        {viewMode === 'trail' && (
          <TrailPath
            locations={trailLocations}
            focusedId={focusedLocation?.id ?? null}
            onPointClick={handleTimelineSelect}
          />
        )}
        {viewMode === 'heatmap' && (
          <HeatmapLayer locations={trailLocations} />
        )}
      </MapView>

      {/* Floating top row */}
      <div style={styles.topRow}>
        {/* Device selector pill */}
        <div style={{ position: 'relative', pointerEvents: 'auto' }}>
          <FloatingPill>
            <button
              onClick={() => setDeviceMenuOpen(o => !o)}
              style={styles.devicePillBtn}
              className="tap-none"
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: selectedDevice?.is_active ? 'var(--green)' : 'var(--text3)',
                flexShrink: 0,
              }} />
              <span style={styles.devicePillName}>
                {devicesLoading ? '...' : selectedDevice?.name ?? 'Nenhum device'}
              </span>
              <Ico name="chevronDown" size={12} color="var(--text2)" />
            </button>
          </FloatingPill>

          {/* Dropdown */}
          {deviceMenuOpen && devices.length > 0 && (
            <div style={styles.dropdown}>
              {devices.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDeviceId(d.id); setDeviceMenuOpen(false); setFocusedLocation(null) }}
                  style={{
                    ...styles.dropdownItem,
                    background: d.id === selectedDeviceId ? 'var(--surface2)' : 'transparent',
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: d.is_active ? 'var(--green)' : 'var(--text3)',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, textAlign: 'left' }}>
                    {d.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View mode toggle pill */}
        <FloatingPill style={{ padding: '4px 5px', gap: 2 }}>
          {VIEW_MODES.map(vm => (
            <button
              key={vm.value}
              onClick={() => setViewMode(vm.value)}
              className="tap-none"
              style={{
                padding: '5px 10px',
                borderRadius: 99,
                border: 'none',
                background: viewMode === vm.value ? 'var(--accent)' : 'transparent',
                color: viewMode === vm.value ? 'white' : 'var(--text2)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.13s',
                whiteSpace: 'nowrap',
              }}
            >
              {vm.label}
            </button>
          ))}
        </FloatingPill>
      </div>

      {/* Date presets (trail / heatmap) */}
      {viewMode !== 'realtime' && (
        <div style={styles.presetsRow}>
          <FloatingPill style={{ padding: '4px 5px', gap: 2 }}>
            {DATE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePresetChange(p.value)}
                className="tap-none"
                style={{
                  padding: '5px 10px',
                  borderRadius: 99,
                  border: datePreset === p.value ? '1px solid var(--border2)' : '1px solid transparent',
                  background: datePreset === p.value ? 'var(--surface2)' : 'transparent',
                  color: datePreset === p.value ? 'var(--text)' : 'var(--text2)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.13s',
                }}
              >
                {p.label}
              </button>
            ))}
          </FloatingPill>
        </div>
      )}

      {/* Empty states */}
      {!devicesLoading && devices.length === 0 && (
        <div style={styles.emptyOverlay}>
          <p style={styles.emptyTitle}>Nenhum device</p>
          <p style={styles.emptyHint}>
            Acesse{' '}
            <a href="/devices" style={{ color: 'var(--text)', textDecoration: 'underline' }}>
              Devices
            </a>{' '}
            para adicionar um.
          </p>
        </div>
      )}

      {viewMode === 'realtime' && selectedDeviceId && !latestLoading && !latestLocation && devices.length > 0 && (
        <div style={styles.emptyOverlay}>
          <p style={styles.emptyTitle}>Aguardando localização</p>
          <p style={styles.emptyHint}>Nenhum dado recebido ainda para este device.</p>
        </div>
      )}

      {/* Status pill (realtime + has location) */}
      {viewMode === 'realtime' && latestLocation && (
        <div style={styles.statusPillWrap}>
          <FloatingPill style={{ padding: '6px 14px', gap: 8 }}>
            {/* Pulse dot */}
            <span style={styles.pulseDotWrap}>
              <span style={styles.pulseDot} />
              <span style={styles.pulseRing} />
            </span>
            <span style={styles.statusText}>{formatAgo(latestLocation.timestamp)}</span>
            {latestLocation.battery_level != null && (
              <>
                <span style={styles.sep} />
                <Ico name="battery" size={13} color="var(--text3)" />
                <span style={styles.statusText}>{latestLocation.battery_level}%</span>
              </>
            )}
            {latestLocation.accuracy != null && (
              <>
                <span style={styles.sep} />
                <span style={styles.statusText}>±{Math.round(latestLocation.accuracy)}m</span>
              </>
            )}
          </FloatingPill>
        </div>
      )}

      {/* Trail stats (trail mode) */}
      {viewMode === 'trail' && !trailLoading && trailLocations.length > 0 && (
        <div style={styles.trailStatsWrap}>
          <div style={{ ...styles.trailStatsCard, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
            {[
              { label: 'Distância', value: `${trailDistance.toFixed(1)} km` },
              { label: 'Duração', value: trailDuration },
              { label: 'Pontos', value: String(trailLocations.length) },
              { label: 'Bateria', value: avgBattery != null ? `${avgBattery}%` : '--' },
            ].map(stat => (
              <div key={stat.label} style={styles.statBox}>
                <span style={styles.statValue}>{stat.value}</span>
                <span style={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap info pill */}
      {viewMode === 'heatmap' && !trailLoading && (
        <div style={styles.statusPillWrap}>
          <FloatingPill style={{ padding: '6px 14px' }}>
            <span style={styles.statusText}>
              {trailLocations.length > 0
                ? `${trailLocations.length} pontos no período`
                : 'Nenhum ponto no período'}
            </span>
          </FloatingPill>
        </div>
      )}

      {/* Overlay to close device dropdown */}
      {deviceMenuOpen && (
        <div
          onClick={() => setDeviceMenuOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 99 }}
        />
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: 'relative',
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 500,
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  devicePillBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    padding: '6px 10px',
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  devicePillName: {
    fontSize: 12,
    fontWeight: 600,
    maxWidth: 110,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text)',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border2)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    minWidth: 180,
    overflow: 'hidden',
    animation: 'fadeIn 0.18s ease',
    zIndex: 200,
    pointerEvents: 'auto',
  },
  dropdownItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  presetsRow: {
    position: 'absolute',
    top: 60,
    left: 12,
    zIndex: 400,
    pointerEvents: 'auto',
  },
  emptyOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 400,
    background: 'rgba(13,26,46,0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border2)',
    borderRadius: 12,
    padding: '20px 24px',
    textAlign: 'center',
    maxWidth: 260,
    pointerEvents: 'none',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 12,
    color: 'var(--text2)',
    lineHeight: 1.5,
  },
  statusPillWrap: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 400,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  pulseDotWrap: {
    position: 'relative',
    width: 10,
    height: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--green)',
    position: 'relative',
    zIndex: 1,
    flexShrink: 0,
  },
  pulseRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'var(--green)',
    animation: 'pulse-ring 2s ease-out infinite',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text2)',
  },
  sep: {
    width: 1,
    height: 12,
    background: 'var(--border2)',
    flexShrink: 0,
  },
  trailStatsWrap: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    zIndex: 400,
    pointerEvents: 'none',
  },
  trailStatsCard: {
    background: 'rgba(13,26,46,0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: 16,
    padding: '14px 16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  statBox: {
    background: 'var(--surface2)',
    borderRadius: 8,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
  },
  statLabel: {
    fontSize: 10,
    color: 'var(--text3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
}
