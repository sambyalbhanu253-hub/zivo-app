import { Link, Navigate, useParams } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'

const destinations: Record<string, { title: string; description: string; icon: IconName }> = {
  history: {
    title: 'History',
    description: 'Videos you watch will appear here.',
    icon: 'history',
  },
  playlists: {
    title: 'Playlists',
    description: 'Save videos into playlists and find them here.',
    icon: 'playlist',
  },
  videos: {
    title: 'Your videos',
    description: 'Videos you create and upload will appear here.',
    icon: 'video',
  },
  downloads: {
    title: 'Downloads',
    description: 'Your downloaded videos will be ready to watch here.',
    icon: 'download',
  },
  analytics: {
    title: 'Analytics',
    description: 'Channel performance and audience insights will appear here.',
    icon: 'analytics',
  },
  channel: {
    title: 'Bhanu Sambyal',
    description: '@BhanuSambyal-e5s6j · 1.64K subscribers · 64 videos',
    icon: 'profile',
  },
}

export default function ProfileSectionPage() {
  const { section } = useParams()
  const destination = section ? destinations[section] : undefined

  if (!destination) return <Navigate replace to="/profile" />

  return (
    <div className="page-content profile-destination-page">
      <Link aria-label="Back to You" className="profile-destination-back" to="/profile">
        <Icon name="back" size={20} />
        <span>You</span>
      </Link>
      {section === 'channel' ? (
        <section className="profile-destination-channel">
          <div aria-label="Bhanu Sambyal profile picture" className="profile-channel-avatar" role="img">BS</div>
          <h1>{destination.title}</h1>
          <p>{destination.description}</p>
        </section>
      ) : (
        <section aria-labelledby="profile-destination-title" className="profile-destination-content">
          <span aria-hidden="true" className="profile-destination-icon">
            <Icon name={destination.icon} size={28} />
          </span>
          <h1 id="profile-destination-title">{destination.title}</h1>
          <p>{destination.description}</p>
          {section === 'videos' && (
            <Link className="profile-view-channel" to="/create">Create a video</Link>
          )}
        </section>
      )}
    </div>
  )
}
