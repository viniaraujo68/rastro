import { NavLink } from 'react-router-dom'
import { Ico } from '../icons/Ico'

const tabs = [
  { to: '/', label: 'Mapa', icon: 'map', end: true },
  { to: '/devices', label: 'Devices', icon: 'devices', end: false },
  { to: '/settings', label: 'Config', icon: 'settings', end: false },
]

export function BottomNav() {
  return (
    <nav style={styles.nav} className="tap-none">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => ({
            ...styles.tab,
            color: isActive ? 'var(--accent)' : 'var(--text3)',
          })}
        >
          {({ isActive }) => (
            <>
              <Ico name={tab.icon} size={22} color={isActive ? 'var(--accent)' : 'var(--text3)'} />
              <span style={styles.label}>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'var(--nav-h)',
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'stretch',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 1000,
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    textDecoration: 'none',
    transition: 'color 0.13s',
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
}
