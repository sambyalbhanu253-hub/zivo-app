import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { loadLocalPosts, releaseLocalPostUrls, type LocalPost } from '../lib/localPosts'

const POST_PREFIX = 'pulse:post:'
const ACTIVE_VISIBILITY_THRESHOLD = 0.65

type ShortVideo = {
  id: string
  source: string
  poster?: string
  caption: string
  creator: string
  handle: string
  likes: number
  createdAt: number
  trimStart?: number
  trimEnd?: number
}

const sampleShorts: ShortVideo[] = [
  {
    id: 'sample-short-1',
    source: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    poster: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=960&q=85',
    caption: 'A little moment of joy.',
    creator: 'Nisha Cooks',
    handle: 'nishacooks',
    likes: 1240,
    createdAt: Date.now(),
  },
  {
    id: 'sample-short-2',
    source: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    poster: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=960&q=85',
    caption: 'The city after dark.',
    creator: 'Frames by Dev',
    handle: 'framesbydev',
    likes: 890,
    createdAt: Date.now() - 3_600_000,
  },
  {
    id: 'sample-short-3',
    source: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    poster: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=960&q=85',
    caption: 'Take the scenic route.',
    creator: 'Aarav on the Move',
    handle: 'aaravonthemove',
    likes: 2100,
    createdAt: Date.now() - 7_200_000,
  },
]

type KeyValueEntry = {
  key: string
  value: unknown
}

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

function readShort(entry: KeyValueEntry): ShortVideo | null {
  if (!isRecord(entry.value)) return null
  const record = isRecord(entry.value.post) ? entry.value.post : entry.value
  const media = isRecord(record.media) ? record.media : {}
  const video = isRecord(record.video) ? record.video : {}
  const source = firstString(record, 'videoSource', 'videoUrl', 'videoURL', 'mediaUrl', 'url') ||
    firstString(media, 'url', 'videoUrl', 'src') ||
    firstString(video, 'url', 'src')
  const format = firstString(record, 'format', 'contentType').toLowerCase()
  const contentType = firstString(record, 'contentType').toLowerCase()
  const declaredType = firstString(record, 'type').toLowerCase()
  const status = firstString(record, 'status', 'visibility').toLowerCase()
  const isPrivateDraft =
    record.isDraft === true ||
    record.isPublished === false ||
    status === 'draft' ||
    status === 'private' ||
    status === 'unpublished'
  const isShort = record.isShort === true || format === 'short' || contentType === 'short' ||
    declaredType === 'short' ||
    (!format && !contentType && !declaredType && record.isLongVideo !== true && Boolean(source))

  if (
    !source || !isShort || isPrivateDraft || contentType === 'image' ||
    record.isLongVideo === true || format === 'long' || format === 'video' ||
    declaredType === 'video'
  ) return null

  const creatorProfile = isRecord(record.creatorProfile) ? record.creatorProfile : {}
  const likesValue = record.likesCount ?? record.likes
  const createdAtValue = record.createdAt
  const createdAt = typeof createdAtValue === 'number'
    ? createdAtValue
    : typeof createdAtValue === 'string'
      ? Date.parse(createdAtValue)
      : 0

  return {
    id: firstString(record, 'id') || entry.key.slice(POST_PREFIX.length),
    source,
    poster: firstString(record, 'thumbnailUrl', 'thumbnail', 'posterUrl', 'poster') ||
      firstString(media, 'thumbnailUrl', 'poster') ||
      undefined,
    caption: firstString(record, 'caption', 'description') || 'A moment shared on PULSE.',
    creator: firstString(record, 'creatorName', 'displayName') ||
      firstString(creatorProfile, 'displayName', 'name') ||
      'PULSE creator',
    handle: firstString(record, 'creatorHandle', 'username') ||
      firstString(creatorProfile, 'username', 'handle') ||
      'creator',
    likes: typeof likesValue === 'number' ? likesValue : 0,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    trimStart: typeof record.trimStart === 'number' && Number.isFinite(record.trimStart)
      ? Math.max(0, record.trimStart)
      : undefined,
    trimEnd: typeof record.trimEnd === 'number' && Number.isFinite(record.trimEnd)
      ? record.trimEnd
      : undefined,
  }
}

function readShortFeed(value: unknown): ShortVideo[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error('The saved video feed returned an unexpected response.')
  }

  const unique = new Map<string, ShortVideo>()
  for (const entry of value.data) {
    if (!isRecord(entry) || typeof entry.key !== 'string') continue
    const short = readShort({ key: entry.key, value: entry.value })
    if (short?.id) unique.set(short.id, short)
  }

  return [...unique.values()].sort((a, b) => b.createdAt - a.createdAt)
}

function parseShortFeedResponse(value: unknown): unknown | null {
  if (typeof value !== 'string') return value

  const responseText = value.trim()
  if (!responseText || (responseText[0] !== '{' && responseText[0] !== '[')) return null

  try {
    return JSON.parse(responseText) as unknown
  } catch {
    return null
  }
}

export default function ShortsPage() {
  const navigate = useNavigate()
  const feedRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef(new Map<string, HTMLVideoElement>())
  const visibilityRef = useRef(new Map<string, number>())
  const activeIdRef = useRef<string | null>(null)
  const soundEnabledRef = useRef(true)
  const localPostsRef = useRef<LocalPost[]>([])
  const [shorts, setShorts] = useState<ShortVideo[]>(sampleShorts)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [paused, setPaused] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set())
  const [playbackError, setPlaybackError] = useState('')

  const pauseAllExcept = useCallback((playingId: string | null) => {
    videosRef.current.forEach((video, id) => {
      if (id === playingId) return
      video.muted = true
      video.pause()
    })
  }, [])

  const loadFeed = useCallback(async (isActive: () => boolean) => {
    const store = window.genmb?.kv
    let cloudEntries: unknown[] = []
    try {
      if (store) {
        const response = parseShortFeedResponse(await store.list(POST_PREFIX))
        if (isRecord(response) && Array.isArray(response.data)) cloudEntries = response.data
      }
    } catch {
      cloudEntries = []
    }
    let localPosts: LocalPost[] = []
    try {
      localPosts = await loadLocalPosts((post) => post.visibility === 'public' && post.type === 'short')
    } catch {
      localPosts = []
    }
    if (!isActive()) {
      releaseLocalPostUrls(localPosts)
      return
    }
    releaseLocalPostUrls(localPostsRef.current)
    localPostsRef.current = localPosts
    const localEntries = localPosts.map((post) => ({
      key: `${POST_PREFIX}${post.id}`,
      value: post,
    }))
    const items = readShortFeed({ data: [...cloudEntries, ...localEntries] })
    setShorts(items.length > 0 ? items : sampleShorts)
  }, [])

  useEffect(() => {
    let active = true
    void loadFeed(() => active)
    return () => {
      active = false
      releaseLocalPostUrls(localPostsRef.current)
      localPostsRef.current = []
    }
  }, [loadFeed])

  useEffect(() => {
    const root = feedRef.current
    if (!root || shorts.length === 0) return

    visibilityRef.current.clear()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.shortId
        if (!id) continue
        visibilityRef.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
      }

      let nextActiveId: string | null = null
      let highestRatio = ACTIVE_VISIBILITY_THRESHOLD
      visibilityRef.current.forEach((ratio, id) => {
        if (ratio > highestRatio) {
          nextActiveId = id
          highestRatio = ratio
        }
      })

      if (nextActiveId !== activeIdRef.current) {
        activeIdRef.current = nextActiveId
        pauseAllExcept(nextActiveId)
        setActiveId(nextActiveId)
        setPaused(false)
        setPlaybackError('')
      }
    }, {
      root,
      threshold: [0, 0.25, 0.5, ACTIVE_VISIBILITY_THRESHOLD, 0.8, 1],
    })

    root.querySelectorAll<HTMLElement>('[data-short-id]').forEach((item) => observer.observe(item))
    return () => {
      observer.disconnect()
      visibilityRef.current.clear()
      activeIdRef.current = null
      pauseAllExcept(null)
    }
  }, [pauseAllExcept, shorts])

  useEffect(() => {
    activeIdRef.current = activeId
    soundEnabledRef.current = soundEnabled
    const shouldPlay = activeId !== null && !paused && !document.hidden

    videosRef.current.forEach((video, id) => {
      if (!shouldPlay || id !== activeId) {
        video.muted = true
        video.pause()
        return
      }

      video.muted = !soundEnabled
      void video.play().catch(async (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (activeIdRef.current !== id || document.hidden || paused) {
          video.muted = true
          video.pause()
          return
        }
        if (soundEnabledRef.current !== soundEnabled) return
        video.muted = true
        try {
          await video.play()
          if (soundEnabledRef.current === soundEnabled) {
            setSoundEnabled(false)
            soundEnabledRef.current = false
          }
        } catch {
          if (activeIdRef.current === id && !document.hidden) {
            setPlaybackError('This video could not be played. Try another short.')
          }
        }
      })
    })
  }, [activeId, paused, soundEnabled])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseAllExcept(null)
        return
      }

      const activeVideo = activeIdRef.current
        ? videosRef.current.get(activeIdRef.current)
        : undefined
      if (!activeVideo || paused) return

      activeVideo.muted = !soundEnabledRef.current
      void activeVideo.play().catch(() => {
        activeVideo.muted = true
        setPlaybackError('Playback needs another tap to resume.')
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pauseAllExcept, paused])

  const toggleSound = async () => {
    const nextEnabled = !soundEnabledRef.current
    soundEnabledRef.current = nextEnabled
    setSoundEnabled(nextEnabled)
    setPlaybackError('')

    if (activeIdRef.current) {
      const video = videosRef.current.get(activeIdRef.current)
      if (video) {
        video.muted = !nextEnabled
        if (nextEnabled) {
          try {
            await video.play()
          } catch {
            video.muted = true
            soundEnabledRef.current = false
            setSoundEnabled(false)
            setPlaybackError('Sound could not be enabled. Tap to try again.')
          }
        }
      }
    }
  }

  const goBack = () => {
    const historyIndex = window.history.state?.idx
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }

  const toggleLike = (id: string) => {
    setLikedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const shareShort = async (short: ShortVideo) => {
    const url = `${window.location.origin}/shorts#${encodeURIComponent(short.id)}`
    try {
      if (navigator.share) await navigator.share({ title: short.caption, url })
      else if (navigator.clipboard) await navigator.clipboard.writeText(url)
      else setPlaybackError('Sharing is not available in this browser.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setPlaybackError('This short could not be shared.')
    }
  }

  if (shorts.length === 0) {
    return (
      <div className="shorts-feed-state shorts-empty" role="status">
        <span className="shorts-play-icon"><Icon name="play" size={30} /></span>
        <p className="eyebrow">PULSE SHORTS</p>
        <h1>Big moments.<br /><span className="accent-text">Short stories.</span></h1>
        <p className="page-description">Short videos from PULSE creators will appear here.</p>
      </div>
    )
  }

  return (
    <div aria-label="Short videos" className="shorts-feed" ref={feedRef}>
      <button
        aria-label="Go back"
        className="shorts-back-button"
        onClick={goBack}
        type="button"
      >
        <Icon name="back" size={21} />
        <span>Back</span>
      </button>
      {shorts.map((short) => {
        const liked = likedIds.has(short.id)
        const isActive = activeId === short.id
        return (
          <article className="shorts-slide" data-short-id={short.id} key={short.id}>
            <video
              aria-label={`Short video by ${short.creator}`}
              autoPlay={isActive && !paused}
              className="shorts-video"
              muted={!isActive || !soundEnabled}
              playsInline
              poster={short.poster}
              preload={isActive ? 'auto' : 'metadata'}
              ref={(element) => {
                if (element) {
                  element.setAttribute('fetchpriority', isActive ? 'high' : 'auto')
                  videosRef.current.set(short.id, element)
                } else {
                  videosRef.current.delete(short.id)
                }
              }}
              src={short.source}
              onLoadedMetadata={(event) => {
                if (short.trimStart && short.trimStart < event.currentTarget.duration) {
                  event.currentTarget.currentTime = short.trimStart
                }
              }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget
                const clipStart = Math.min(short.trimStart ?? 0, video.duration)
                const clipEnd = Math.min(short.trimEnd ?? video.duration, video.duration)
                if (clipEnd > clipStart && video.currentTime >= clipEnd) {
                  video.currentTime = clipStart
                }
              }}
              onEnded={(event) => {
                const video = event.currentTarget
                video.currentTime = Math.min(short.trimStart ?? 0, video.duration)
                if (isActive && !paused) {
                  void video.play().catch(() => {
                    setPlaybackError('This video could not be played. Try another short.')
                  })
                }
              }}
              onClick={() => isActive && setPaused((wasPaused) => !wasPaused)}
            />
            <div aria-hidden="true" className="shorts-gradient" />
            {isActive && paused && (
              <button
                aria-label="Resume video"
                className="shorts-resume"
                onClick={() => setPaused(false)}
                type="button"
              >
                <Icon name="play" size={36} />
              </button>
            )}
            <div className="shorts-details">
              <p className="shorts-creator">@{short.handle}</p>
              <p className="shorts-caption">{short.caption}</p>
            </div>
            <div aria-label="Video actions" className="shorts-actions">
              <button
                aria-label={liked ? 'Unlike short' : 'Like short'}
                aria-pressed={liked}
                className={`shorts-action-button${liked ? ' is-liked' : ''}`}
                onClick={() => toggleLike(short.id)}
                type="button"
              >
                <Icon name="heart" size={25} />
                <span>{short.likes + (liked ? 1 : 0)}</span>
              </button>
              <button
                aria-label={!isActive ? 'Sound controls for active short' : soundEnabled ? 'Mute short' : 'Unmute short'}
                aria-pressed={soundEnabled && isActive}
                className={`shorts-action-button shorts-sound-button${isActive && soundEnabled ? ' is-sound-enabled' : ''}`}
                disabled={!isActive}
                onClick={toggleSound}
                type="button"
              >
                <Icon name={soundEnabled && isActive ? 'volumeOn' : 'volumeOff'} size={23} />
                <span>{soundEnabled && isActive ? 'Mute' : 'Unmute'}</span>
              </button>
              <button
                aria-label="Share short"
                className="shorts-action-button"
                onClick={() => void shareShort(short)}
                type="button"
              >
                <Icon name="share" size={23} />
                <span>Share</span>
              </button>
            </div>
            {isActive && playbackError && <p className="shorts-playback-error" role="status">{playbackError}</p>}
          </article>
        )
      })}
    </div>
  )
}
