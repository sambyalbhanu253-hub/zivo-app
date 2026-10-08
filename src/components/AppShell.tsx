import { Link, Outlet, useLocation } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import Icon from './Icon'

export default function AppShell() {
  const { pathname } = useLocation()
  const isShortsRoute = pathname === '/shorts' || pathname.startsWith('/shorts/')
  const isStudioRoute = pathname === '/create'
  const isProfileRoute = pathname === '/profile' || pathname.startsWith('/profile/')
  const isImmersiveRoute = isShortsRoute || isStudioRoute

  return (
    <div className={`app-frame${isShortsRoute ? ' shorts-frame' : ''}${isStudioRoute ? ' studio-frame' : ''}${isProfileRoute ? ' profile-route-frame' : ''}`}>
      {!isImmersiveRoute && (
        <header className="app-header">
          <Link aria-label="PULSE home" className="brand" to="/">
            <img alt="" className="brand-logo" height="42" src="/icons/pulse-brand.svg" width="166" />
          </Link>
          <span className="header-tagline">Watch what moves you.</span>
          <Link aria-label="Messages" className="header-message-link" to="/messages">
            <Icon name="messages" size={19} />
            <span>Messages</span>
          </Link>
        </header>
      )}
      <main className={`app-main${isShortsRoute ? ' shorts-main' : ''}${isStudioRoute ? ' studio-main' : ''}`}>
        <Outlet />
      </main>
      {!isImmersiveRoute && <BottomNavigation />}
    </div>
  )
}
