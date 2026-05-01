import { useState } from 'react'
import { Ico } from '../icons/Ico'

interface ApiKeyDisplayProps {
  apiKey: string
}

export function ApiKeyDisplay({ apiKey }: ApiKeyDisplayProps) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={styles.wrapper}>
      <p style={styles.label}>API Key</p>
      <div style={styles.keyRow}>
        <code style={styles.key}>
          {visible ? apiKey : '•'.repeat(Math.min(apiKey.length, 32))}
        </code>
        <button onClick={() => setVisible(v => !v)} style={styles.btn}>
          {visible ? 'Ocultar' : 'Revelar'}
        </button>
        <button onClick={handleCopy} style={styles.btn}>
          {copied
            ? <><Ico name="check" size={12} color="var(--green)" /> Copiado</>
            : <><Ico name="copy" size={12} /> Copiar</>
          }
        </button>
      </div>
      <p style={styles.hint}>
        Use este token no header <code>X-Device-Key</code> do Shortcut.
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text3)',
  },
  keyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  key: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'monospace',
    color: 'var(--text2)',
    wordBreak: 'break-all',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  btn: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text2)',
    cursor: 'pointer',
    fontWeight: 500,
  },
  hint: {
    fontSize: 11,
    color: 'var(--text3)',
  },
}
