import { Outlet, useLocation } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { BottomNav } from './BottomNav'
import { SidebarNav } from './SidebarNav'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Mapa',
  '/devices': 'Devices',
  '/settings': 'Configurações',
}

export default function AppLayout() {
  const isMobile = useIsMobile()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? ''

  if (isMobile) {
    return (
      <div style={styles.mobileRoot}>
        {/* Top header bar */}
        <header style={styles.mobileHeader}>
          <span style={styles.mobileLogo}>Rastro</span>
          {pageTitle && <span style={styles.mobileTitle}>{pageTitle}</span>}
        </header>

        {/* Page content */}
        <div style={styles.mobileContent}>
          <Outlet />
        </div>

        <BottomNav />
      </div>
    )
  }

  return (
    <div style={styles.desktopRoot}>
      <SidebarNav />
      <div style={styles.desktopContent}>
        <Outlet />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  mobileRoot: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  mobileHeader: {
    height: 52,
    flexShrink: 0,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 12,
    zIndex: 100,
  },
  mobileLogo: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
  },
  mobileTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text2)',
  },
  mobileContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 'var(--nav-h)',
  },
  desktopRoot: {
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  desktopContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
