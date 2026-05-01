import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { LatLngExpression } from 'leaflet'
import { MapView } from '../components/Map/MapView'
import { DeviceMarker } from '../components/Map/DeviceMarker'
import { getSharedLocation } from '../lib/api'
import type { Location } from '../types'

const DEFAULT_CENTER: LatLngExpression = [-22.9068, -43.1729]

function formatAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min atrás`
  return `${Math.floor(m / 60)}h atrás`
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const fetchLocation = useCallback(async () => {
    if (!token) return
    try {
      const data = await getSharedLocation(token)
      setDeviceName(data.device.name)
      setLocation(data.location)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [token])

  useEffect(() => {
    fetchLocation()
    const id = setInterval(fetchLocation, 30_000)
    return () => clearInterval(id)
  }, [fetchLocation])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const mapCenter: LatLngExpression = location
    ? [location.latitude, location.longitude]
    : DEFAULT_CENTER

  if (error) {
    return (
      <div style={styles.errorPage}>
        <div style={styles.errorCard}>
          <p style={styles.errorTitle}>Link inválido ou expirado</p>
          <p style={styles.errorHint}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.logo}>Rastro</span>
        {deviceName && <span style={styles.deviceName}>{deviceName}</span>}
        {location && (
          <span style={styles.timestamp}>
            <span style={styles.dot} />
            {formatAgo(location.timestamp)}
          </span>
        )}
      </div>

      <div style={styles.mapWrap}>
        <MapView center={mapCenter} zoom={location ? 14 : 12}>
          {location && deviceName && (
            <DeviceMarker location={location} deviceName={deviceName} />
          )}
        </MapView>

        {!location && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>Aguardando localização</p>
            <p style={styles.emptyHint}>Nenhum dado recebido ainda.</p>
          </div>
        )}
      </div>

      {location && (
        <div style={styles.footer}>
          <span>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
          {location.battery_level != null && (
            <span>🔋 {location.battery_level}%</span>
          )}
          {location.accuracy != null && (
            <span>±{Math.round(location.accuracy)}m</span>
          )}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f1117',
    overflow: 'hidden',
  },
  header: {
    height: 48,
    background: '#070e1c',
    borderBottom: '1px solid #1a2540',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 12,
    flexShrink: 0,
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    color: '#e8edf5',
    letterSpacing: '-0.3px',
  },
  deviceName: {
    fontSize: 13,
    color: '#8b9ab4',
    flex: 1,
  },
  timestamp: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#8b9ab4',
  },
  dot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#10b981',
    flexShrink: 0,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  empty: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 400,
    background: 'rgba(22,29,47,0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid #2a3550',
    borderRadius: 12,
    padding: '20px 24px',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e8edf5',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 12,
    color: '#8b9ab4',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '8px 16px',
    background: '#070e1c',
    borderTop: '1px solid #1a2540',
    fontSize: 11,
    color: '#5c6b84',
    flexShrink: 0,
  },
  errorPage: {
    height: '100vh',
    background: '#0f1117',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    background: '#161d2f',
    border: '1px solid #2a3550',
    borderRadius: 12,
    padding: '28px 32px',
    textAlign: 'center',
    maxWidth: 320,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#e8edf5',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 13,
    color: '#5c6b84',
  },
}
