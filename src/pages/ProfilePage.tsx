import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountsModal from '../components/AccountsModal'
import Icon, { type IconName } from '../components/Icon'
import { DEFAULT_CHANNEL_PROFILE, loadChannelProfile, saveChannelProfile, type ChannelProfile } from '../lib/channelProfile'
import type { ConnectedAccount } from '../lib/connectedAccounts'

const profileLinks: { label: string; path: string; icon: IconName }[] = [
  { label: 'History', path: '/profile/history', icon: 'history' },
  { label: 'Playlists', path: '/profile/playlists', icon: 'playlist' },
  { label: 'Your videos', path: '/profile/videos', icon: 'video' },
  { label: 'Downloads', path: '/profile/downloads', icon: 'download' },
  { label: 'Analytics', path: '/profile/analytics', icon: 'analytics' },
]

export default function ProfilePage() {
  const [channel, setChannel] = useState<ChannelProfile>(DEFAULT_CHANNEL_PROFILE)
  const [profileError, setProfileError] = useState('')
  const [accountsOpen, setAccountsOpen] = useState(false)

  useEffect(() => {
    try {
      setChannel(loadChannelProfile())
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : 'Saved channel details could not be loaded.')
    }
  }, [])

  function handleAccountChange(account: ConnectedAccount) {
    const nextChannel = {
      ...channel,
      name: account.name,
      handle: account.handle,
      avatarUrl: account.pictureUrl,
    }
    try {
      saveChannelProfile(nextChannel)
      setChannel(nextChannel)
      setProfileError('')
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : 'The creator profile could not be saved.')
    }
  }

  return (
    <div className="page-content profile-hub-page">
      <section aria-labelledby="profile-channel-name" className="profile-channel-header">
        <div
          aria-label={`${channel.name} profile picture`}
          className="profile-channel-avatar"
          role="img"
          style={channel.avatarUrl ? { backgroundImage: `url("${channel.avatarUrl}")` } : undefined}
        >{!channel.avatarUrl && channel.name.slice(0, 1).toUpperCase()}</div>
        <div className="profile-channel-details">
          <h1 id="profile-channel-name">{channel.name}</h1>
          <p className="profile-channel-handle">@{channel.handle}</p>
          <p className="profile-channel-stats">1.64K subscribers <span aria-hidden="true">•</span> 64 videos</p>
        </div>
        <Link className="profile-view-channel" to="/profile/channel">View channel</Link>
      </section>
      {profileError && <p className="edit-channel-message is-error" role="alert">{profileError}</p>}

      <button className="profile-view-channel accounts-open-button" onClick={() => setAccountsOpen(true)} type="button">
        Accounts
      </button>

      <nav aria-label="Your library" className="profile-library-list">
        {profileLinks.map((item) => (
          <Link className="profile-library-link" key={item.path} to={item.path}>
            <span className="profile-library-icon"><Icon name={item.icon} size={22} /></span>
            <span>{item.label}</span>
            <Icon name="chevron" size={18} />
          </Link>
        ))}
      </nav>
      {accountsOpen && <AccountsModal onAccountChange={handleAccountChange} onClose={() => setAccountsOpen(false)} />}
    </div>
  )
}
