import { useState } from 'react'

export interface DateRange {
  from: string
  to: string
}

type Preset = 'today' | '24h' | '7d' | '30d' | 'custom'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Custom' },
]

function buildRange(preset: Exclude<Preset, 'custom'>): DateRange {
  const now = new Date()
  const to = now.toISOString()

  switch (preset) {
    case 'today': {
      const from = new Date(now)
      from.setHours(0, 0, 0, 0)
      return { from: from.toISOString(), to }
    }
    case '24h':
      return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), to }
    case '7d':
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to }
    case '30d':
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to }
  }
}

function toInputValue(iso: string) {
  if (!iso) return ''
  return iso.slice(0, 16)
}

function fromInputValue(value: string): string {
  return value ? new Date(value).toISOString() : ''
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [preset, setPreset] = useState<Preset>('24h')

  function handlePreset(p: Preset) {
    setPreset(p)
    if (p !== 'custom') {
      onChange(buildRange(p))
    }
  }

  return (
    <div style={styles.section}>
      <p style={styles.label}>Período</p>
      <div style={styles.presets}>
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            style={{ ...styles.presetBtn, ...(preset === p.value ? styles.presetBtnActive : {}) }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div style={styles.customRow}>
          <label style={styles.customLabel}>
            De
            <input
              type="datetime-local"
              value={toInputValue(value.from)}
              onChange={e => onChange({ ...value, from: fromInputValue(e.target.value) })}
              style={styles.input}
            />
          </label>
          <label style={styles.customLabel}>
            Até
            <input
              type="datetime-local"
              value={toInputValue(value.to)}
              onChange={e => onChange({ ...value, to: fromInputValue(e.target.value) })}
              style={styles.input}
            />
          </label>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    padding: '14px 16px',
    borderBottom: '1px solid #2a3550',
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#5c6b84',
    marginBottom: 8,
  },
  presets: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  presetBtn: {
    padding: '4px 9px',
    border: '1px solid #2a3550',
    borderRadius: 6,
    fontSize: 12,
    background: '#1c2538',
    color: '#8b9ab4',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.12s',
  },
  presetBtnActive: {
    background: '#e8edf5',
    color: '#0f1117',
    borderColor: '#e8edf5',
  },
  customRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  customLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    color: '#8b9ab4',
    fontWeight: 500,
  },
  input: {
    padding: '5px 8px',
    border: '1px solid #2a3550',
    borderRadius: 6,
    fontSize: 12,
    outline: 'none',
    background: '#1c2538',
    color: '#e8edf5',
    colorScheme: 'dark',
  },
}

export { buildRange }
