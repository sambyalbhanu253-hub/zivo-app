import { loadLocalPosts, releaseLocalPostUrls } from './localPosts'
import type { LocalPost } from './localPosts'

const POST_PREFIX = 'pulse:post:'

export type LongVideo = {
  id: string
  title: string
  description: string
  creator: string
  handle: string
  thumbnail?: string
  source: string
  views: number
  subscriberCount?: number
  createdAt: number
  category: string
  duration?: string
  contentType: 'video' | 'image'
}

export const sampleVideos: LongVideo[] = [
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

export function parseLongVideo(entry: unknown): LongVideo | null {
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
  const subscriberCountValue = record.subscriberCount ??
    record.subscribersCount ??
    creatorProfile.subscriberCount ??
    creatorProfile.subscribersCount

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
    subscriberCount: typeof subscriberCountValue === 'number' && Number.isFinite(subscriberCountValue)
      ? Math.max(0, subscriberCountValue)
      : undefined,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    category: firstString(record, 'category', 'topic') || 'Other',
    duration: firstString(record, 'duration', 'durationLabel') || undefined,
    contentType: contentType === 'image' ? 'image' : 'video',
  }
}

export function formatVideoAge(createdAt: number) {
  if (!createdAt) return 'Recently'
  const hours = Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(createdAt)
}

export function videoPoster(video: LongVideo) {
  if (video.thumbnail) {
    return video.thumbnail.startsWith('http')
      ? video.thumbnail
      : `https://images.unsplash.com/${video.thumbnail}?auto=format&fit=crop&w=960&q=78`
  }
  const media = window.GenMBFileStorage?.resolveAsset(video.source)
  return media ? `${media.mediaBase}/thumbnail.jpg` : undefined
}

export function formatViews(views: number) {
  return `${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(views)} views`
}

export async function loadLongVideos(): Promise<{ videos: LongVideo[]; release: () => void }> {
  const store = window.genmb?.kv
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
  const localPostsPromise = loadLocalPosts((post) => post.visibility === 'public').catch((): LocalPost[] => [])
  const [cloudVideos, posts] = await Promise.all([cloudVideosPromise, localPostsPromise])
  const mergedVideos = new Map<string, LongVideo>()
  for (const video of cloudVideos) mergedVideos.set(video.id, video)
  for (const post of posts) {
    const video = parseLongVideo({ key: `${POST_PREFIX}${post.id}`, value: post })
    if (video) mergedVideos.set(video.id, video)
  }

  return {
    videos: [...mergedVideos.values()].sort((first, second) => second.createdAt - first.createdAt),
    release: () => releaseLocalPostUrls(posts),
  }
}
