import { useState, type FormEvent } from 'react'

interface PermissionFormProps {
  onGrant: (email: string, permission: 'view' | 'admin') => Promise<void>
}

export function PermissionForm({ onGrant }: PermissionFormProps) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'view' | 'admin'>('view')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onGrant(email, permission)
      setEmail('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="email"
        required
        placeholder="email@exemplo.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={styles.input}
      />
      <select
        value={permission}
        onChange={e => setPermission(e.target.value as 'view' | 'admin')}
        style={styles.select}
      >
        <option value="view">Visualização</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" disabled={loading} style={styles.btn}>
        {loading ? '...' : 'Convidar'}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 160,
    padding: '6px 10px',
    border: '1px solid var(--border2)',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    background: 'var(--surface2)',
    color: 'var(--text)',
  },
  select: {
    padding: '6px 8px',
    border: '1px solid var(--border2)',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--surface2)',
    color: 'var(--text)',
    outline: 'none',
    colorScheme: 'dark',
  },
  btn: {
    padding: '6px 14px',
    background: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    width: '100%',
    fontSize: 12,
    color: 'var(--red)',
    background: 'var(--red-dim)',
    padding: '6px 10px',
    borderRadius: 6,
  },
}
