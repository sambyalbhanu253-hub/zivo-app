import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import LongVideoPlayer from '../components/LongVideoPlayer'
import { loadLocalPosts, releaseLocalPostUrls, type LocalPost } from '../lib/localPosts'

const POST_PREFIX = 'pulse:post:'

type LongVideo = {
  id: string
  title: string
  description: string
  creator: string
  handle: string
  thumbnail?: string
  source: string
  views: number
  createdAt: number
  category: string
  duration?: string
  contentType: 'video' | 'image'
}

const videos: LongVideo[] = [
  {
    id: 'mountain-sunrise',
    title: 'I woke up at 4AM for this sunrise in the Himalayas',
    description: 'A sunrise over the mountains.',
    creator: 'Aarav on the Move',
    handle: 'aaravonthemove',
    thumbnail: 'photo-1464822759023-fed622ff2c3b',
    source: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    views: 248000,
    createdAt: Date.now() - 2 * 86_400_000,
    duration: '18:42',
    category: 'Travel',
    contentType: 'video',
  },
  {
    id: 'homemade-ramen',
    title: 'The coziest homemade ramen you can make in 20 minutes',
    description: 'A cozy homemade ramen recipe.',
    creator: 'Nisha Cooks',
    handle: 'nishacooks',
    thumbnail: 'photo-1569718212165-3a8278d5f624',
    source: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    views: 86000,
    createdAt: Date.now() - 6 * 3_600_000,
    duration: '12:08',
    category: 'Food',
    contentType: 'video',
  },
  {
    id: 'film-photography',
    title: 'Why shooting film changed the way I see the world',
    description: 'A creator story about film photography.',
    creator: 'Frames by Dev',
    handle: 'framesbydev',
    thumbnail: 'photo-1470252649378-9c29740c9fa8',
    source: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    views: 132000,
    createdAt: Date.now() - 7 * 86_400_000,
    duration: '09:36',
    category: 'Design',
    contentType: 'video',
  },
  {
    id: 'indie-playlist',
    title: 'A little indie playlist for slow, sunny afternoons',
    description: 'An indie playlist for sunny afternoons.',
    creator: 'Mira Makes Music',
    handle: 'miramakesmusic',
    thumbnail: 'photo-1492684223066-81342ee5ff30',
    source: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    views: 51000,
    createdAt: Date.now() - 3 * 86_400_000,
    duration: '24:17',
    category: 'Music',
    contentType: 'video',
  },
  {
    id: 'cozy-games',
    title: 'The most relaxing games to play after a long day',
    description: 'Relaxing games to play after a long day.',
    creator: 'Pixel Picnic',
    handle: 'pixelpicnic',
    thumbnail: 'photo-1511512578047-dfb367046420',
    source: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    views: 97000,
    createdAt: Date.now() - 86_400_000,
    duration: '15:53',
    category: 'Gaming',
    contentType: 'video',
  },
]

const shorts = [
  { id: 'chai-break', creator: 'Nisha Cooks', caption: 'बस 5 मिनट में मसाला चाय ☕', image: 'photo-1571934811356-5cc061b6821f' },
  { id: 'city-lights', creator: 'Frames by Dev', caption: 'रात का शहर कुछ अलग ही है ✨', image: 'photo-1519608487953-e999c86e7455' },
  { id: 'little-joys', creator: 'Mira Makes Music', caption: 'छोटी खुशियाँ ही तो ज़िंदगी हैं 💛', image: 'photo-1500530855697-b586d89ba3ee' },
  { id: 'mountain-air', creator: 'Aarav on the Move', caption: 'पहाड़ बुला रहे हैं 🏔️', image: 'photo-1470770841072-f978cf4d019e' },
]

const topics = ['For you', 'Music', 'Travel', 'Food', 'Gaming', 'Design', 'Other']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function parseLongVideo(entry: unknown): LongVideo | null {
  if (!isRecord(entry) || typeof entry.key !== 'string' || !isRecord(entry.value)) return null
  const record = isRecord(entry.value.post) ? entry.value.post : entry.value
  const media = isRecord(record.media) ? record.media : {}
  const creatorProfile = isRecord(record.creatorProfile) ? record.creatorProfile : {}
  const source = firstString(record, 'videoSource', 'videoUrl', 'videoURL', 'mediaUrl', 'url') ||
    firstString(media, 'url', 'videoUrl', 'src')
  const format = firstString(record, 'format', 'contentType').toLowerCase()
  const contentType = firstString(record, 'contentType').toLowerCase()
  const declaredType = firstString(record, 'type').toLowerCase()
  const status = firstString(record, 'status', 'visibility').toLowerCase()
  const isShort = record.isShort === true || format === 'short' || contentType === 'short' || declaredType === 'short'
  const isLongVideo = !isShort && (
    contentType === 'image' || record.isLongVideo === true || format === 'long' ||
    format === 'video' || declaredType === 'video' || record.isLongVideo === false
  )

  if (
    !source ||
    isShort ||
    !isLongVideo ||
    record.isDraft === true ||
    record.isPublished === false ||
    status === 'draft' ||
    status === 'private' ||
    status === 'unlisted' ||
    status === 'unpublished'
  ) return null

  const id = firstString(record, 'id') || entry.key.slice(POST_PREFIX.length)
  if (!id) return null

  const createdAtValue = record.createdAt
  const createdAt = typeof createdAtValue === 'number'
    ? createdAtValue
    : typeof createdAtValue === 'string'
      ? Date.parse(createdAtValue)
      : 0
  const viewsValue = record.viewsCount ?? record.views
  const category = firstString(record, 'category', 'topic') || 'Other'

  return {
    id,
    title: firstString(record, 'title', 'caption', 'description') || 'Untitled video',
    description: firstString(record, 'description', 'caption'),
    creator: firstString(record, 'creatorName', 'displayName') ||
      firstString(creatorProfile, 'displayName', 'name') ||
      'PULSE creator',
    handle: firstString(record, 'creatorHandle', 'username') ||
      firstString(creatorProfile, 'username', 'handle') ||
      'creator',
    thumbnail: firstString(record, 'thumbnailUrl', 'thumbnail', 'posterUrl', 'poster') ||
      firstString(media, 'thumbnailUrl', 'poster') ||
      undefined,
    source,
    views: typeof viewsValue === 'number' ? viewsValue : 0,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    category,
    duration: firstString(record, 'duration', 'durationLabel') || undefined,
    contentType: contentType === 'image' ? 'image' : 'video',
  }
}

function formatVideoAge(createdAt: number) {
  if (!createdAt) return 'Recently'
  const hours = Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(createdAt)
}

function videoPoster(video: LongVideo) {
  if (video.thumbnail) {
    return video.thumbnail.startsWith('http')
      ? video.thumbnail
      : `https://images.unsplash.com/${video.thumbnail}?auto=format&fit=crop&w=960&q=78`
  }
  const media = window.GenMBFileStorage?.resolveAsset(video.source)
  return media ? `${media.mediaBase}/thumbnail.jpg` : undefined
}

function formatViews(views: number) {
  return `${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(views)} views`
}

export default function HomePage() {
  const [activeTopic, setActiveTopic] = useState('For you')
  const [hiddenVideos, setHiddenVideos] = useState<string[]>([])
  const [savedVideos, setSavedVideos] = useState<string[]>([])
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [longVideos, setLongVideos] = useState<LongVideo[]>([])
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
  const hasManualPlayerSelectionRef = useRef(false)
  const filteredLongVideos = useMemo(() => longVideos.filter((video) =>
    !hiddenVideos.includes(video.id) && (activeTopic === 'For you' || video.category === activeTopic),
  ), [activeTopic, hiddenVideos, longVideos])
  const filteredSampleVideos = videos.filter((video) =>
    !hiddenVideos.includes(video.id) && (activeTopic === 'For you' || video.category === activeTopic),
  )

  useEffect(() => {
    let active = true
    const store = window.genmb?.kv
    let localPosts: LocalPost[] = []
    void (async () => {
      const cloudVideosPromise = (async () => {
        if (!store) return []
        try {
          const response = await store.list(POST_PREFIX)
          if (!isRecord(response) || !Array.isArray(response.data)) return []
          return response.data
            .map(parseLongVideo)
            .filter((video): video is LongVideo => video !== null)
        } catch {
          return []
        }
      })()
      const localPostsPromise = loadLocalPosts((post) => post.visibility === 'public').catch(() => [])
      const [cloudVideos, posts] = await Promise.all([cloudVideosPromise, localPostsPromise])
      if (!active) {
        releaseLocalPostUrls(posts)
        return
      }
      localPosts = posts
      const mergedVideos = new Map<string, LongVideo>()
      for (const video of cloudVideos) mergedVideos.set(video.id, video)
      for (const post of posts) {
        const video = parseLongVideo({ key: `${POST_PREFIX}${post.id}`, value: post })
        if (video) mergedVideos.set(video.id, video)
      }
      const loadedVideos = [...mergedVideos.values()]
        .sort((first, second) => second.createdAt - first.createdAt)
      setLongVideos(loadedVideos)
      if (loadedVideos.length > 0 && !hasManualPlayerSelectionRef.current) {
        setActivePlayerId(loadedVideos[0].id)
      }
    })()

    return () => {
      active = false
      releaseLocalPostUrls(localPosts)
    }
  }, [])

  const feedVideos = [...filteredLongVideos, ...filteredSampleVideos]

  useEffect(() => {
    if (!feedVideos.some((video) => video.id === activePlayerId)) {
      setActivePlayerId(feedVideos[0]?.id ?? null)
    }
  }, [activePlayerId, feedVideos])

  function toggleSaved(videoId: string) {
    setSavedVideos((current) =>
      current.includes(videoId) ? current.filter((id) => id !== videoId) : [...current, videoId],
    )
    setOpenMenu(null)
  }

  function hideVideo(videoId: string) {
    setHiddenVideos((current) => [...current, videoId])
    setOpenMenu(null)
  }

  return (
    <div className="home-page">
      <div aria-label="Video categories" className="home-topic-bar">
        <div className="home-topic-list">
          {topics.map((topic) => (
            <button
              aria-pressed={activeTopic === topic}
              className={`home-topic${activeTopic === topic ? ' is-active' : ''}`}
              key={topic}
              onClick={() => setActiveTopic(topic)}
              type="button"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      <div className="home-feed">
        {feedVideos.length === 0 && (
          <p className="home-empty-state">No videos in this category yet. Try another topic.</p>
        )}
        {feedVideos.map((video, index) => (
          <div className="home-feed-item" key={video.id}>
            <article aria-label={video.title} className="video-card">
              <div className="video-thumbnail">
                {video.contentType === 'image' ? (
                  <img
                    alt={video.title}
                    className="video-image-preview"
                    loading={index > 1 ? 'lazy' : 'eager'}
                    src={video.source}
                  />
                ) : activePlayerId === video.id ? (
                  <LongVideoPlayer source={video.source} poster={videoPoster(video)} title={video.title} />
                ) : (
                  <button
                    aria-label={`Play ${video.title}`}
                    className="long-video-poster-button"
                    onClick={() => {
                      hasManualPlayerSelectionRef.current = true
                      setActivePlayerId(video.id)
                    }}
                    type="button"
                  >
                    {videoPoster(video) && (
                      <img
                        alt=""
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        loading={index > 1 ? 'lazy' : 'eager'}
                        src={videoPoster(video)}
                      />
                    )}
                    <span className="long-video-play"><Icon name="play" size={23} /></span>
                    {video.duration && <span className="video-duration">{video.duration}</span>}
                  </button>
                )}
              </div>
              <div className="video-information">
                <span aria-hidden="true" className="video-avatar long-video-avatar">{video.creator.slice(0, 1).toUpperCase()}</span>
                <div className="video-copy">
                  <h2>{video.title}</h2>
                  <p>{video.creator} <span aria-hidden="true">·</span> @{video.handle}</p>
                  <p>{formatViews(video.views)}<span aria-hidden="true"> · </span>{formatVideoAge(video.createdAt)}</p>
                  {video.description && video.description !== video.title && <p className="long-video-description">{video.description}</p>}
                </div>
                <div className="video-options">
                  <button
                    aria-expanded={openMenu === video.id}
                    aria-label={`More options for ${video.title}`}
                    className="video-options-button"
                    onClick={() => setOpenMenu((current) => current === video.id ? null : video.id)}
                    type="button"
                  >
                    <span aria-hidden="true">⋮</span>
                  </button>
                  {openMenu === video.id && (
                    <div className="video-options-menu">
                      <button onClick={() => toggleSaved(video.id)} type="button">
                        {savedVideos.includes(video.id) ? 'Remove from saved' : 'Save for later'}
                      </button>
                      <button onClick={() => hideVideo(video.id)} type="button">Not interested</button>
                    </div>
                  )}
                </div>
              </div>
            </article>
            {index === 1 && activeTopic === 'For you' && (
              <section aria-labelledby="home-shorts-heading" className="home-shorts-shelf">
                <div className="home-shorts-heading">
                  <span className="home-shorts-icon"><Icon name="shorts" size={19} /></span>
                  <h2 id="home-shorts-heading">Shorts</h2>
                  <Link aria-label="See all Shorts" className="home-shelf-link" to="/shorts">
                    See all <Icon name="arrow" size={15} />
                  </Link>
                </div>
                <div className="home-shorts-carousel">
                  {shorts.map((short) => (
                    <Link className="home-short-card" key={short.id} to="/shorts">
                      <img
                        alt=""
                        loading="lazy"
                        src={`https://images.unsplash.com/${short.image}?auto=format&fit=crop&w=540&q=85`}
                      />
                      <span aria-hidden="true" className="home-short-play"><Icon name="play" size={17} /></span>
                      <span className="home-short-caption">{short.caption}</span>
                      <span className="home-short-creator">{short.creator}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
