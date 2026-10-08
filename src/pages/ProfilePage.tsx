import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'

const profileLinks: { label: string; path: string; icon: IconName }[] = [
  { label: 'History', path: '/profile/history', icon: 'history' },
  { label: 'Playlists', path: '/profile/playlists', icon: 'playlist' },
  { label: 'Your videos', path: '/profile/videos', icon: 'video' },
  { label: 'Downloads', path: '/profile/downloads', icon: 'download' },
  { label: 'Analytics', path: '/profile/analytics', icon: 'analytics' },
]

export default function ProfilePage() {
  return (
    <div className="page-content profile-hub-page">
      <section aria-labelledby="profile-channel-name" className="profile-channel-header">
        <div aria-label="Bhanu Sambyal profile picture" className="profile-channel-avatar" role="img">BS</div>
        <div className="profile-channel-details">
          <h1 id="profile-channel-name">Bhanu Sambyal</h1>
          <p className="profile-channel-handle">@BhanuSambyal-e5s6j</p>
          <p className="profile-channel-stats">1.64K subscribers <span aria-hidden="true">•</span> 64 videos</p>
        </div>
        <Link className="profile-view-channel" to="/profile/channel">View channel</Link>
      </section>

      <nav aria-label="Your library" className="profile-library-list">
        {profileLinks.map((item) => (
          <Link className="profile-library-link" key={item.path} to={item.path}>
            <span className="profile-library-icon"><Icon name={item.icon} size={22} /></span>
            <span>{item.label}</span>
            <Icon name="chevron" size={18} />
          </Link>
        ))}
      </nav>
    </div>
  )
}
