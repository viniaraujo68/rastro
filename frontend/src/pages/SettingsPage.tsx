import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Ico } from '../components/icons/Ico'

const POLLING_OPTIONS = [
  { ms: 15_000, label: '15s' },
  { ms: 30_000, label: '30s' },
  { ms: 60_000, label: '60s' },
]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [pollingMs, setPollingMs] = useState<number>(() => {
    const stored = localStorage.getItem('rastro_polling_ms')
    return stored ? Number(stored) : 30_000
  })

  function handlePollingChange(ms: number) {
    setPollingMs(ms)
    localStorage.setItem('rastro_polling_ms', String(ms))
  }

  return (
    <div style={styles.root}>
      <div style={styles.content}>

        {/* Conta */}
        <div style={styles.sectionGroup}>
          <p style={styles.sectionLabel}>CONTA</p>
          <div style={styles.card}>
            {/* Email row */}
            <div style={styles.row}>
              <div style={styles.rowIcon}>
                <Ico name="mail" size={16} color="var(--text2)" />
              </div>
              <div style={styles.rowInfo}>
                <span style={styles.rowLabel}>E-mail</span>
                <span style={styles.rowValue}>{user?.email}</span>
              </div>
            </div>
            <div style={styles.divider} />
            {/* ID row */}
            <div style={styles.row}>
              <div style={styles.rowIcon}>
                <Ico name="user" size={16} color="var(--text2)" />
              </div>
              <div style={styles.rowInfo}>
                <span style={styles.rowLabel}>ID</span>
                <span style={{ ...styles.rowValue, fontFamily: 'monospace', fontSize: 12 }}>
                  {user?.id?.slice(0, 8)}…
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Preferências */}
        <div style={styles.sectionGroup}>
          <p style={styles.sectionLabel}>PREFERÊNCIAS</p>
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={styles.rowIcon}>
                <Ico name="refresh" size={16} color="var(--text2)" />
              </div>
              <div style={styles.rowInfo}>
                <span style={styles.rowLabel}>Intervalo de atualização</span>
                <div style={styles.pollingRow}>
                  {POLLING_OPTIONS.map(opt => (
                    <button
                      key={opt.ms}
                      onClick={() => handlePollingChange(opt.ms)}
                      style={{
                        ...styles.pollingBtn,
                        ...(pollingMs === opt.ms ? styles.pollingBtnActive : styles.pollingBtnInactive),
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessão */}
        <div style={styles.sectionGroup}>
          <p style={styles.sectionLabel}>SESSÃO</p>
          <div style={styles.card}>
            <button onClick={signOut} style={styles.signOutRow}>
              <div style={styles.signOutIcon}>
                <Ico name="logout" size={16} color="var(--red)" />
              </div>
              <span style={styles.signOutText}>Sair da conta</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: { flex: 1, overflowY: 'auto', background: 'var(--bg)' },
  content: { padding: '20px 16px', maxWidth: 520, width: '100%', margin: '0 auto' },
  sectionGroup: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
    color: 'var(--text3)', marginBottom: 8,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 16px',
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'var(--surface2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 11,
    color: 'var(--text3)',
  },
  rowValue: {
    fontSize: 13,
    color: 'var(--text2)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '0 16px',
  },
  pollingRow: {
    display: 'flex',
    gap: 6,
    marginTop: 2,
  },
  pollingBtn: {
    padding: '5px 12px',
    border: '1px solid',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.13s',
  },
  pollingBtnActive: {
    background: 'var(--accent-dim)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  pollingBtnInactive: {
    background: 'var(--surface2)',
    borderColor: 'var(--border)',
    color: 'var(--text2)',
  },
  signOutRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  signOutIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'var(--red-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--red)',
  },
}
