import { Link, Outlet, useLocation } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import Icon from './Icon'

export default function AppShell() {
  const { pathname } = useLocation()
  const isShortsRoute = pathname === '/shorts' || pathname.startsWith('/shorts/')

  return (
    <div className={`app-frame${isShortsRoute ? ' shorts-frame' : ''}`}>
      {!isShortsRoute && (
        <header className="app-header">
          <Link aria-label="ZIVO home" className="brand" to="/">
            <img alt="" className="brand-mark" height="42" src="/icons/zivo-icon-192.svg" width="42" />
            <span>ZIVO</span>
          </Link>
          <span className="header-tagline">Watch what moves you.</span>
          <Link aria-label="Messages" className="header-message-link" to="/messages">
            <Icon name="messages" size={19} />
            <span>Messages</span>
          </Link>
        </header>
      )}
      <main className={`app-main${isShortsRoute ? ' shorts-main' : ''}`}>
        <Outlet />
      </main>
      {!isShortsRoute && <BottomNavigation />}
    </div>
  )
}
