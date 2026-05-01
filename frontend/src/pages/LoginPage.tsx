import { useState, FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Ico } from '../components/icons/Ico'

export default function LoginPage() {
  const { session, loading } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(error.message)
        else setInfo('Conta criada! Você já está logado.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Logo area above card */}
      <div style={styles.logoArea}>
        <div style={styles.iconBox}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
        <h1 style={styles.logoTitle}>Rastro</h1>
        <p style={styles.logoSubtitle}>Rastreamento de localização pessoal</p>
      </div>

      {/* Card */}
      <div style={styles.card}>
        {/* Tab toggle */}
        <div style={styles.tabRow}>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); setInfo('') }}
            style={{ ...styles.tabBtn, ...((!isSignUp) ? styles.tabBtnActive : styles.tabBtnInactive) }}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); setInfo('') }}
            style={{ ...styles.tabBtn, ...(isSignUp ? styles.tabBtnActive : styles.tabBtnInactive) }}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Email input */}
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcon}>
              <Ico name="mail" size={15} color="var(--text3)" />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="seu@email.com"
            />
          </div>

          {/* Password input */}
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcon}>
              <Ico name="lock" size={15} color="var(--text3)" />
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}
          {info && <p style={styles.infoMsg}>{info}</p>}

          <button type="submit" disabled={submitting} style={styles.submitBtn}>
            {submitting ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 20,
  },
  logoArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'var(--accent)',
    boxShadow: '0 8px 24px rgba(59,127,245,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.5px',
    lineHeight: 1,
  },
  logoSubtitle: {
    fontSize: 14,
    color: 'var(--text3)',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  },
  tabRow: {
    display: 'flex',
    background: 'var(--bg)',
    borderRadius: 10,
    padding: 4,
    border: '1px solid var(--border)',
    marginBottom: 20,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    padding: '7px 0',
    border: 'none',
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.13s',
  },
  tabBtnActive: {
    background: 'var(--surface)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
  },
  tabBtnInactive: {
    background: 'transparent',
    color: 'var(--text3)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 11,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 9,
    color: 'var(--text)',
    outline: 'none',
    fontSize: 14,
    transition: 'border-color 0.15s',
  },
  submitBtn: {
    marginTop: 4,
    padding: 12,
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(59,127,245,0.35)',
    transition: 'opacity 0.13s',
  },
  error: {
    color: 'var(--red)',
    fontSize: 13,
    background: 'var(--red-dim)',
    padding: '8px 12px',
    borderRadius: 6,
  },
  infoMsg: {
    color: 'var(--green)',
    fontSize: 13,
    background: 'var(--green-dim)',
    padding: '8px 12px',
    borderRadius: 6,
  },
}
