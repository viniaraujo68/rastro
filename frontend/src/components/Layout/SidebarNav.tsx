import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Ico } from '../icons/Ico'

const navItems = [
  { to: '/', label: 'Mapa', icon: 'map', end: true },
  { to: '/devices', label: 'Devices', icon: 'devices', end: false },
  { to: '/settings', label: 'Configurações', icon: 'settings', end: false },
]

export function SidebarNav() {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      style={{
        ...styles.sidebar,
        width: collapsed ? 56 : 220,
      }}
      className="tap-none"
    >
      <div style={styles.top}>
        <div style={styles.logoRow}>
          {!collapsed && (
            <span style={styles.logo}>Rastro</span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={styles.toggleBtn}
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? (
              // hamburger
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            ) : (
              <Ico name="x" size={16} />
            )}
          </button>
        </div>

        <nav style={styles.nav}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : styles.navItemInactive),
                justifyContent: collapsed ? 'center' : 'flex-start',
                paddingLeft: collapsed ? 0 : 12,
                paddingRight: collapsed ? 0 : 12,
              })}
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Ico
                    name={item.icon}
                    size={18}
                    color={isActive ? 'var(--accent)' : 'var(--text3)'}
                  />
                  {!collapsed && (
                    <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 500 }}>
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div style={styles.bottom}>
        {!collapsed && user?.email && (
          <div style={styles.userEmail} title={user.email}>
            {user.email}
          </div>
        )}
        <button
          onClick={signOut}
          style={{
            ...styles.logoutBtn,
            justifyContent: collapsed ? 'center' : 'flex-start',
            paddingLeft: collapsed ? 0 : 12,
            paddingRight: collapsed ? 0 : 12,
          }}
          title="Sair"
        >
          <Ico name="logout" size={18} color="var(--text3)" />
          {!collapsed && <span style={{ marginLeft: 10 }}>Sair</span>}
        </button>
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    flexShrink: 0,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
    zIndex: 100,
  },
  top: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 12px 12px',
    flexShrink: 0,
    minHeight: 56,
  },
  logo: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: 'var(--surface2)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text2)',
    flexShrink: 0,
    transition: 'background 0.13s',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '4px 8px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    borderRadius: 8,
    textDecoration: 'none',
    transition: 'background 0.13s, color 0.13s',
    paddingRight: 12,
    gap: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  navItemActive: {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
  },
  navItemInactive: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text3)',
  },
  bottom: {
    flexShrink: 0,
    padding: '8px 8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderTop: '1px solid var(--border)',
  },
  userEmail: {
    fontSize: 12,
    color: 'var(--text3)',
    padding: '4px 12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    borderRadius: 8,
    background: 'transparent',
    border: 'none',
    color: 'var(--text3)',
    paddingRight: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: 500,
    transition: 'background 0.13s',
  },
}
