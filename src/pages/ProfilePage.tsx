import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthProvider'

type CreatorVideo = {
  id: string
  title: string
  thumbnail: string
  views: number
  duration: string
  hoursAgo: number
  visibility: 'Public' | 'Unlisted'
}

type CreatorShort = {
  id: string
  title: string
  thumbnail: string
  views: number
  hoursAgo: number
  visibility: 'Public' | 'Unlisted'
}

type ContentFilter = 'Latest' | 'Popular' | 'Oldest' | 'Public' | 'Unlisted'
type ProfileTab = 'Home' | 'Videos' | 'Shorts' | 'Posts'

const contentFilters: ContentFilter[] = ['Latest', 'Popular', 'Oldest', 'Public', 'Unlisted']
const profileTabs: ProfileTab[] = ['Home', 'Videos', 'Shorts', 'Posts']

const sampleVideos: CreatorVideo[] = [
  {
    id: 'slow-mornings',
    title: 'A slower kind of morning: coffee, light & a little reset',
    thumbnail: 'photo-1495474472287-4d71bcdd2085',
    views: 18420,
    duration: '12:46',
    hoursAgo: 4,
    visibility: 'Public',
  },
  {
    id: 'weekend-film',
    title: 'I spent the weekend shooting on 35mm film',
    thumbnail: 'photo-1470252649378-9c29740c9fa8',
    views: 8670,
    duration: '18:12',
    hoursAgo: 29,
    visibility: 'Public',
  },
  {
    id: 'desk-makeover',
    title: 'My tiny desk makeover (and the setup I actually use)',
    thumbnail: 'photo-1498050108023-c5249f4df085',
    views: 52300,
    duration: '09:38',
    hoursAgo: 120,
    visibility: 'Unlisted',
  },
  {
    id: 'city-walk',
    title: 'A quiet walk through the city after the rain',
    thumbnail: 'photo-1519608487953-e999c86e7455',
    views: 12300,
    duration: '15:04',
    hoursAgo: 360,
    visibility: 'Public',
  },
]

const sampleShorts: CreatorShort[] = [
  {
    id: 'coffee-pour',
    title: 'The perfect slow pour ☕',
    thumbnail: 'photo-1442512595331-e89e73853f31',
    views: 128400,
    hoursAgo: 2,
    visibility: 'Public',
  },
  {
    id: 'golden-hour',
    title: 'Golden hour found me ✨',
    thumbnail: 'photo-1470252649378-9c29740c9fa8',
    views: 64700,
    hoursAgo: 46,
    visibility: 'Public',
  },
  {
    id: 'desk-details',
    title: 'Little details, big difference',
    thumbnail: 'photo-1498050108023-c5249f4df085',
    views: 28400,
    hoursAgo: 144,
    visibility: 'Unlisted',
  },
  {
    id: 'rainy-day',
    title: 'POV: you took the long way home',
    thumbnail: 'photo-1519608487953-e999c86e7455',
    views: 9100,
    hoursAgo: 528,
    visibility: 'Public',
  },
]

const creatorPosts = [
  {
    id: 'next-video',
    date: 'Today',
    text: 'New video is up! A little reminder to make room for slower mornings. What does your ideal morning look like?',
    likes: '248',
  },
  {
    id: 'film-poll',
    date: '3 days ago',
    text: 'Planning the next shoot — should I take the film camera downtown or out to the coast?',
    likes: '126',
  },
]

function relativeUploadTime(hoursAgo: number) {
  if (hoursAgo < 24) return `${Math.max(1, hoursAgo)}h ago`
  const days = Math.floor(hoursAgo / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatViews(views: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(views)
}

function sortByFilter<T extends { views: number; hoursAgo: number; visibility: string }>(
  items: T[],
  filter: ContentFilter,
) {
  const filtered = items.filter((item) =>
    filter !== 'Public' && filter !== 'Unlisted' ? true : item.visibility === filter,
  )
  return [...filtered].sort((a, b) => {
    if (filter === 'Popular') return b.views - a.views
    if (filter === 'Oldest') return b.hoursAgo - a.hoursAgo
    return a.hoursAgo - b.hoursAgo
  })
}

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<ProfileTab>('Home')
  const [activeFilter, setActiveFilter] = useState<ContentFilter>('Latest')
  const [videos, setVideos] = useState(sampleVideos)
  const [shorts, setShorts] = useState(sampleShorts)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const visibleVideos = useMemo(() => sortByFilter(videos, activeFilter), [videos, activeFilter])
  const visibleShorts = useMemo(() => sortByFilter(shorts, activeFilter), [shorts, activeFilter])
  const channelName = user?.displayName || 'Your channel'
  const initials = channelName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  function toggleVisibility(id: string, contentType: 'video' | 'short') {
    if (contentType === 'video') {
      setVideos((current) => current.map((item) =>
        item.id === id ? { ...item, visibility: item.visibility === 'Public' ? 'Unlisted' : 'Public' } : item,
      ))
    } else {
      setShorts((current) => current.map((item) =>
        item.id === id ? { ...item, visibility: item.visibility === 'Public' ? 'Unlisted' : 'Public' } : item,
      ))
    }
    setOpenMenu(null)
  }

  function renderVideoList(items: CreatorVideo[]) {
    if (items.length === 0) {
      return <p className="creator-empty-state">No videos match this filter yet.</p>
    }

    return (
      <div className="creator-video-list">
        {items.map((video) => (
          <article className="creator-video-row" key={video.id}>
            <div className="creator-video-thumbnail">
              <img
                alt=""
                loading="lazy"
                src={`https://images.unsplash.com/${video.thumbnail}?auto=format&fit=crop&w=640&q=85`}
              />
              <span className="creator-duration">{video.duration}</span>
            </div>
            <div className="creator-video-details">
              <h3>{video.title}</h3>
              <p>{formatViews(video.views)} views <span aria-hidden="true">·</span> {relativeUploadTime(video.hoursAgo)}</p>
              <span className={`creator-visibility${video.visibility === 'Unlisted' ? ' is-unlisted' : ''}`}>
                {video.visibility}
              </span>
            </div>
            <div className="creator-content-menu">
              <button
                aria-expanded={openMenu === video.id}
                aria-label={`Manage ${video.title}`}
                className="creator-menu-button"
                onClick={() => setOpenMenu((current) => current === video.id ? null : video.id)}
                type="button"
              >
                <span aria-hidden="true">⋮</span>
              </button>
              {openMenu === video.id && (
                <div className="creator-menu-popover">
                  <button onClick={() => toggleVisibility(video.id, 'video')} type="button">
                    Make {video.visibility === 'Public' ? 'unlisted' : 'public'}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    )
  }

  function renderShortsGrid(items: CreatorShort[]) {
    if (items.length === 0) {
      return <p className="creator-empty-state">No Shorts match this filter yet.</p>
    }

    return (
      <div className="creator-shorts-grid">
        {items.map((short) => (
          <article className="creator-short-card" key={short.id}>
            <div className="creator-short-thumbnail">
              <img
                alt=""
                loading="lazy"
                src={`https://images.unsplash.com/${short.thumbnail}?auto=format&fit=crop&w=480&q=85`}
              />
              <span className="creator-short-views"><Icon name="play" size={13} /> {formatViews(short.views)}</span>
              <div className="creator-content-menu">
                <button
                  aria-expanded={openMenu === short.id}
                  aria-label={`Manage ${short.title}`}
                  className="creator-menu-button"
                  onClick={() => setOpenMenu((current) => current === short.id ? null : short.id)}
                  type="button"
                >
                  <span aria-hidden="true">⋮</span>
                </button>
                {openMenu === short.id && (
                  <div className="creator-menu-popover creator-menu-popover--short">
                    <button onClick={() => toggleVisibility(short.id, 'short')} type="button">
                      Make {short.visibility === 'Public' ? 'unlisted' : 'public'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <h3>{short.title}</h3>
            <p>{relativeUploadTime(short.hoursAgo)} <span aria-hidden="true">·</span> {short.visibility}</p>
          </article>
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-content">
        <section className="feature-card profile-card">
          <span className="feature-icon"><Icon name="profile" size={24} /></span>
          <p className="eyebrow">CREATOR STUDIO</p>
          <h2>Make ZIVO yours</h2>
          <p>Sign in or create an account to build your channel, share videos, and grow your creator circle.</p>
          <div className="profile-auth-actions">
            <Link className="primary-button" to="/sign-in">Sign in <Icon name="arrow" size={17} /></Link>
            <Link className="text-link" to="/sign-up">Create an account <Icon name="arrow" size={16} /></Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-content creator-page">
      <section aria-label="Creator channel dashboard preview" className="creator-dashboard">
        <div className="creator-cover">
          <span>YOUR CHANNEL, YOUR STORY</span>
          <button className="creator-signout" onClick={signOut} type="button">Sign out</button>
        </div>
        <div className="creator-channel">
          <div aria-hidden="true" className="creator-avatar">{initials || 'Z'}</div>
          <div className="creator-channel-copy">
            <p className="eyebrow">CREATOR STUDIO</p>
            <h1>{channelName}</h1>
            <p>@{channelName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'creator'} <span aria-hidden="true">·</span> {videos.length + shorts.length} uploads</p>
          </div>
          <Link className="creator-upload-button" to="/create"><Icon name="create" size={17} /> Create</Link>
        </div>
        <div aria-label="Channel analytics" className="creator-analytics">
          <div><span>Views · last 28 days</span><strong>84.2K</strong><small className="creator-growth">↗ 18.6%</small></div>
          <div><span>Watch time</span><strong>2.6K <small>hrs</small></strong><small className="creator-growth">↗ 12.4%</small></div>
          <div><span>Subscribers</span><strong>1,284</strong><small className="creator-growth">↗ 86 this month</small></div>
        </div>
      </section>

      <nav aria-label="Creator profile tabs" className="creator-tabs">
        {profileTabs.map((tab) => (
          <button
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`creator-tab${activeTab === tab ? ' is-active' : ''}`}
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setActiveFilter('Latest')
              setOpenMenu(null)
            }}
            type="button"
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Home' && (
        <section aria-labelledby="creator-home-heading" className="creator-tab-panel">
          <div className="creator-section-heading">
            <div><p className="eyebrow">YOUR CREATOR SPACE</p><h2 id="creator-home-heading">Channel overview</h2></div>
            <span className="creator-updated">Last 28 days</span>
          </div>
          <div className="creator-overview-card">
            <div className="creator-overview-icon"><Icon name="sparkles" size={21} /></div>
            <div><h3>Your creator studio at a glance</h3><p>Sample content and insights preview how your channel management experience will look.</p></div>
          </div>
          <div className="creator-section-heading creator-recent-heading">
            <h2>Recent uploads</h2>
            <button className="creator-inline-link" onClick={() => setActiveTab('Videos')} type="button">View all</button>
          </div>
          {renderVideoList(sortByFilter(videos, 'Latest').slice(0, 2))}
        </section>
      )}

      {(activeTab === 'Videos' || activeTab === 'Shorts') && (
        <section aria-label={`${activeTab} content`} className="creator-tab-panel">
          <div className="creator-section-heading">
            <div><p className="eyebrow">CONTENT LIBRARY</p><h2>{activeTab}</h2></div>
            <span className="creator-updated">{activeTab === 'Videos' ? videos.length : shorts.length} uploads</span>
          </div>
          <div aria-label="Filter and sort content" className="creator-filter-list">
            {contentFilters.map((filter) => (
              <button
                aria-pressed={activeFilter === filter}
                className={`creator-filter${activeFilter === filter ? ' is-active' : ''}`}
                key={filter}
                onClick={() => {
                  setActiveFilter(filter)
                  setOpenMenu(null)
                }}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          {activeTab === 'Videos' ? renderVideoList(visibleVideos) : renderShortsGrid(visibleShorts)}
        </section>
      )}

      {activeTab === 'Posts' && (
        <section aria-label="Channel posts" className="creator-tab-panel">
          <div className="creator-section-heading">
            <div><p className="eyebrow">COMMUNITY</p><h2>Posts</h2></div>
            <button className="creator-inline-link" type="button">Create a post</button>
          </div>
          <div className="creator-post-list">
            {creatorPosts.map((post) => (
              <article className="creator-post-card" key={post.id}>
                <div className="creator-post-avatar">{initials || 'Z'}</div>
                <div><div className="creator-post-meta"><strong>{channelName}</strong><span>{post.date}</span></div><p>{post.text}</p><span className="creator-post-likes"><Icon name="heart" size={15} /> {post.likes} likes</span></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
