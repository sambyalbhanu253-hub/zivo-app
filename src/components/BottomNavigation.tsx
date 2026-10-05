import { NavLink } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

const tabs: { label: string; path: string; icon: IconName }[] = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Shorts', path: '/shorts', icon: 'shorts' },
  { label: 'Create', path: '/create', icon: 'create' },
  { label: 'Subscriptions', path: '/subscriptions', icon: 'discover' },
  { label: 'You', path: '/profile', icon: 'profile' },
]

export default function BottomNavigation() {
  return (
    <nav aria-label="Primary navigation" className="bottom-navigation">
      {tabs.map((tab) => (
        <NavLink
          aria-label={tab.label}
          className={({ isActive }) =>
            `navigation-link${isActive ? ' is-active' : ''}${tab.path === '/create' ? ' navigation-create' : ''}`
          }
          end={tab.path === '/'}
          key={tab.path}
          to={tab.path}
        >
          <span className="navigation-icon"><Icon name={tab.icon} size={21} /></span>
          <span className="navigation-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
