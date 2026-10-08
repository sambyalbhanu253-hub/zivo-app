import {
  loadLocalPosts,
  releaseLocalPostUrls,
  updateLocalPost,
  type LocalPost,
} from './localPosts'

const POST_PREFIX = 'pulse:post:'
const PROFILE_PREFIX = 'pulse:profile:'
const LEGACY_ACCOUNTS_KEY = 'pulse.local-auth.accounts.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getKv() {
  const kv = window.genmb?.kv
  if (!kv) throw new Error('PULSE cloud data is unavailable. Open the app from its configured GenMB deployment.')
  return kv
}

function getStorage() {
  const storage = window.genmb?.storage
  if (!storage) throw new Error('PULSE cloud video storage is unavailable. Try again from the configured app deployment.')
  return storage
}

type PostEntry = { key: string; value: Record<string, unknown> }

function readList(value: unknown): PostEntry[] {
  const entries = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.data) ? value.data : null
  if (!entries) {
    throw new Error('PULSE cloud storage returned an unexpected post list.')
  }
  return entries.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.key !== 'string') return []
    const candidate = isRecord(entry.value) && isRecord(entry.value.post) ? entry.value.post : entry.value
    return isRecord(candidate) ? [{ key: entry.key, value: candidate }] : []
  })
}

function firstString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function normalizePost(key: string, value: Record<string, unknown>): LocalPost | null {
  const record = isRecord(value.post) ? value.post : value
  const media = isRecord(record.media) ? record.media : {}
  const video = isRecord(record.video) ? record.video : {}
  const id = firstString(record, 'id') || key.slice(POST_PREFIX.length)
  const videoSource = firstString(record, 'videoSource', 'videoUrl', 'videoURL', 'mediaUrl', 'url') ||
    firstString(media, 'url', 'videoUrl', 'src') ||
    firstString(video, 'url', 'src')
  const rawVisibility = firstString(record, 'visibility').toLowerCase()
  const rawStatus = firstString(record, 'status').toLowerCase()
  const visibility = rawVisibility === 'public' || rawVisibility === 'private' ||
      rawVisibility === 'unlisted' || rawVisibility === 'local'
    ? rawVisibility
    : rawStatus !== 'private' && rawStatus !== 'unlisted' && rawStatus !== 'local' &&
        rawStatus !== 'draft' && rawStatus !== 'unpublished' &&
        record.isDraft !== true && record.isPublished !== false
      ? 'public'
      : null
  const declaredType = firstString(record, 'type').toLowerCase()
  const rawFormat = firstString(record, 'format', 'contentType').toLowerCase()
  const rawContentType = firstString(record, 'contentType').toLowerCase()
  const format = rawContentType === 'image'
    ? 'long'
    : declaredType === 'short' || rawFormat === 'short' || record.isShort === true
    ? 'short'
    : declaredType === 'video' || rawFormat === 'long' || rawFormat === 'video' || record.isLongVideo === true
      ? 'long'
      : videoSource
        ? 'short'
        : null
  const createdAtValue = record.createdAt
  const createdAt = typeof createdAtValue === 'number'
    ? createdAtValue
    : typeof createdAtValue === 'string'
      ? Date.parse(createdAtValue)
      : 0
  const creatorProfile = isRecord(record.creatorProfile) ? record.creatorProfile : {}
  const title = firstString(record, 'title') || firstString(record, 'caption') || 'Untitled video'
  const description = firstString(record, 'description')
  const creatorId = firstString(record, 'creatorId', 'authorId', 'userId') ||
    firstString(creatorProfile, 'userId', 'id')

  if (!id || !videoSource || !visibility || !format || !Number.isFinite(createdAt)) return null
  if (record.isDraft === true || record.isPublished === false || rawStatus === 'draft' || rawStatus === 'unpublished') return null

  return {
    id,
    title,
    description,
    caption: firstString(record, 'caption') || description || title,
    hashtags: firstString(record, 'hashtags'),
    format,
    type: rawContentType === 'image' ? 'image' : format === 'short' ? 'short' : 'video',
    contentType: rawContentType === 'image' ? 'image' : format === 'short' ? 'short' : 'video',
    visibility,
    creatorId,
    creatorName: firstString(record, 'creatorName', 'displayName') ||
      firstString(creatorProfile, 'displayName', 'name') || 'PULSE creator',
    creatorHandle: firstString(record, 'creatorHandle', 'username') ||
      firstString(creatorProfile, 'username', 'handle') || 'creator',
    createdAt,
    localMediaId: firstString(record, 'localMediaId') || id,
    videoSource,
    media: { url: videoSource },
    isShort: format === 'short',
    isLongVideo: format === 'long' && rawContentType !== 'image',
    isDraft: false,
    isPublished: true,
    status: 'published',
    madeForKids: record.madeForKids === true,
    category: firstString(record, 'category') || 'Other',
    likesCount: typeof record.likesCount === 'number' ? record.likesCount : 0,
    viewsCount: typeof record.viewsCount === 'number' ? record.viewsCount : 0,
  }
}

function getLegacyAccountIds(email: string) {
  try {
    const saved = window.localStorage.getItem(LEGACY_ACCOUNTS_KEY)
    if (!saved) return []
    const value: unknown = JSON.parse(saved)
    if (!Array.isArray(value)) return []
    return value.flatMap((candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.email !== 'string') return []
      return candidate.email.trim().toLowerCase() === email.trim().toLowerCase() ? [candidate.id] : []
    })
  } catch {
    return []
  }
}

function profileKey(userId: string) {
  return `${PROFILE_PREFIX}${userId}`
}

export async function loadCloudProfile(userId: string, email: string, fallbackName: string) {
  const kv = getKv()
  const existing = await kv.get(profileKey(userId), { scope: 'user' })
  if (isRecord(existing)) {
    const displayName = typeof existing.displayName === 'string' ? existing.displayName.trim() : ''
    if (displayName) return displayName
  }

  const displayName = fallbackName.trim() || email.split('@')[0] || 'PULSE creator'
  await kv.set(profileKey(userId), {
    userId,
    email,
    displayName,
    bio: '',
    avatarUrl: '',
    updatedAt: Date.now(),
  }, { scope: 'user' })
  return displayName
}

export async function saveCloudPost(post: LocalPost, file: File) {
  const asset = await getStorage().upload(file, { folder: `pulse/videos/${post.creatorId}` })
  if (!asset.url) throw new Error('The video was uploaded but no cloud playback URL was returned.')

  const cloudPost: LocalPost = {
    ...post,
    videoSource: asset.url,
    media: { url: asset.url },
  }
  const options = post.visibility === 'public' ? { owned: true } : { scope: 'user' as const }
  await getKv().set(`${POST_PREFIX}${post.id}`, cloudPost, options)
  return cloudPost
}

export async function loadCreatorPosts(userId: string, email: string) {
  let localPosts: LocalPost[] = []
  let localError = ''
  try {
    const localIds = [userId, ...getLegacyAccountIds(email)]
    localPosts = await loadLocalPosts((post) => localIds.includes(post.creatorId))
  } catch (reason) {
    localError = reason instanceof Error ? reason.message : 'Local upload backups could not be loaded.'
  }

  let remotePosts: LocalPost[]
  try {
    const kv = getKv()
    const [publicResponse, privateResponse] = await Promise.all([
      kv.list(POST_PREFIX),
      kv.list(POST_PREFIX, { scope: 'user' }),
    ])
    remotePosts = [...readList(publicResponse), ...readList(privateResponse)]
      .map(({ key, value }) => normalizePost(key, value))
      .filter((post): post is LocalPost => post !== null && post.creatorId === userId)
  } catch (reason) {
    return {
      posts: localPosts,
      warning: `${localPosts.length
        ? "Cloud uploads could not be refreshed; showing this device's saved copies."
        : 'Cloud uploads could not be reached.'} ${reason instanceof Error ? reason.message : ''}`.trim(),
    }
  }

  const merged = new Map<string, LocalPost>()
  for (const post of localPosts) merged.set(post.id, post)
  for (const post of remotePosts) merged.set(post.id, post)
  return {
    posts: [...merged.values()].sort((first, second) => second.createdAt - first.createdAt),
    warning: localError ? `Some on-device backups could not be loaded: ${localError}` : '',
  }
}

export async function loadPublicPosts(userId?: string, email?: string) {
  let localPosts: LocalPost[] = []
  let localError = ''
  if (userId && email) {
    try {
      const localIds = [userId, ...getLegacyAccountIds(email)]
      localPosts = await loadLocalPosts((post) => localIds.includes(post.creatorId) && post.visibility === 'public')
    } catch (reason) {
      localError = reason instanceof Error ? reason.message : 'On-device uploads could not be loaded.'
    }
  } else {
    try {
      localPosts = await loadLocalPosts((post) => post.visibility === 'public')
    } catch (reason) {
      localError = reason instanceof Error ? reason.message : 'On-device public uploads could not be loaded.'
    }
  }

  try {
    const publicResponse = await getKv().list(POST_PREFIX)
    const remotePosts = readList(publicResponse)
      .map(({ key, value }) => normalizePost(key, value))
      .filter((post): post is LocalPost => post !== null && post.visibility === 'public')
    const merged = new Map<string, LocalPost>()
    for (const post of localPosts) merged.set(post.id, post)
    for (const post of remotePosts) merged.set(post.id, post)
    return {
      posts: [...merged.values()].sort((first, second) => second.createdAt - first.createdAt),
      warning: localError ? `Some on-device uploads could not be loaded: ${localError}` : '',
    }
  } catch (reason) {
    return {
      posts: localPosts,
      warning: `${localPosts.length
        ? "Cloud feed could not be refreshed; showing this device's public uploads."
        : 'The cloud feed could not be reached.'} ${reason instanceof Error ? reason.message : ''}`.trim(),
    }
  }
}

export async function updateCloudPost(
  post: LocalPost,
  update: Pick<LocalPost, 'title' | 'description' | 'caption' | 'visibility'>,
) {
  const options = post.visibility === 'public' ? { owned: true } : { scope: 'user' as const }
  const nextPost = { ...post, ...update }
  const nextOptions = update.visibility === 'public' ? { owned: true } : { scope: 'user' as const }
  await getKv().set(`${POST_PREFIX}${post.id}`, nextPost, nextOptions)
  if (post.visibility !== update.visibility) {
    await getKv().delete?.(`${POST_PREFIX}${post.id}`, options)
  }
  try {
    await updateLocalPost(post.id, update)
  } catch {
    // The cloud update succeeded; an unavailable device backup must not undo it.
  }
  return nextPost
}

export async function migrateLegacyUploads(userId: string, email: string, displayName: string) {
  const legacyIds = getLegacyAccountIds(email)
  if (!legacyIds.length) return
  const posts = await loadLocalPosts((post) => legacyIds.includes(post.creatorId))
  try {
    for (const post of posts) {
      const response = await getKv().get(`${POST_PREFIX}${post.id}`, post.visibility === 'public' ? undefined : { scope: 'user' })
      const existing = isRecord(response) ? normalizePost(`${POST_PREFIX}${post.id}`, response) : null
      if (existing?.creatorId === userId) continue
      if (!post.videoSource) throw new Error(`The saved video "${post.title}" has no readable local media.`)
      const responseBlob = await fetch(post.videoSource)
      if (!responseBlob.ok) throw new Error(`The saved video "${post.title}" could not be read for cloud sync.`)
      const blob = await responseBlob.blob()
      const file = new File([blob], `${post.id}.mp4`, { type: blob.type || 'video/mp4' })
      await saveCloudPost({
        ...post,
        creatorId: userId,
        creatorName: displayName,
      }, file)
    }
  } finally {
    releaseLocalPostUrls(posts)
  }
}
