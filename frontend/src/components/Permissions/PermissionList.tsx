import type { Permission } from '../../types'

interface PermissionListProps {
  permissions: Permission[]
  loading?: boolean
  onRevoke: (userId: string) => void
}

export function PermissionList({ permissions, loading, onRevoke }: PermissionListProps) {
  if (loading) return <p style={styles.hint}>Carregando acessos...</p>

  if (permissions.length === 0) {
    return <p style={styles.hint}>Nenhum usuário com acesso ainda.</p>
  }

  return (
    <ul style={styles.list}>
      {permissions.map(p => (
        <li key={p.id} style={styles.item}>
          <div style={styles.info}>
            <span style={styles.email}>{p.user_email}</span>
            <span style={styles.badge}>{p.permission === 'admin' ? 'Admin' : 'Visualização'}</span>
          </div>
          <button onClick={() => onRevoke(p.user_id)} style={styles.revokeBtn}>
            Revogar
          </button>
        </li>
      ))}
    </ul>
  )
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    background: 'var(--surface2)',
    borderRadius: 8,
  },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  email: {
    fontSize: 13,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    flexShrink: 0,
    fontSize: 11,
    padding: '2px 7px',
    background: 'rgba(99,102,241,0.15)',
    color: '#a5b4fc',
    borderRadius: 99,
    fontWeight: 500,
  },
  revokeBtn: {
    flexShrink: 0,
    fontSize: 12,
    padding: '4px 10px',
    background: 'var(--red-dim)',
    border: '1px solid rgba(248,113,113,0.2)',
    color: 'var(--red)',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 500,
  },
  hint: {
    fontSize: 12,
    color: 'var(--text3)',
  },
}
