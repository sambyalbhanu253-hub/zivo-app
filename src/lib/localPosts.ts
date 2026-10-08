export type PostVisibility = 'public' | 'private' | 'unlisted' | 'local'
export type LocalPostFormat = 'long' | 'short'

export type LocalPost = {
  id: string
  title: string
  description: string
  caption: string
  hashtags?: string
  format: LocalPostFormat
  type: 'video' | 'short' | 'image'
  contentType: 'video' | 'short' | 'image'
  visibility: PostVisibility
  creatorId: string
  creatorName: string
  creatorHandle: string
  createdAt: number
  localMediaId: string
  videoSource?: string
  media?: { url: string }
  trimStart?: number
  trimEnd?: number
  isShort: boolean
  isLongVideo: boolean
  madeForKids?: boolean
  isDraft: boolean
  isPublished: boolean
  status: 'draft' | 'published'
  category: string
  likesCount: number
  viewsCount: number
}

const POST_PREFIX = 'pulse:post:'
const DATABASE_NAME = 'pulse-local-media'
const DATABASE_VERSION = 2
const MEDIA_STORE = 'videos'
const POST_STORE = 'posts'

function isLocalPost(value: unknown): value is LocalPost {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const post = value as Record<string, unknown>
  return typeof post.id === 'string' &&
    typeof post.title === 'string' &&
    typeof post.description === 'string' &&
    typeof post.creatorId === 'string' &&
    typeof post.localMediaId === 'string' &&
    typeof post.createdAt === 'number' &&
    (post.format === 'long' || post.format === 'short') &&
    (post.type === undefined || post.type === 'video' || post.type === 'short' || post.type === 'image') &&
    (post.contentType === undefined || post.contentType === 'video' || post.contentType === 'short' || post.contentType === 'image') &&
    (post.visibility === 'public' || post.visibility === 'private' || post.visibility === 'unlisted' || post.visibility === 'local')
}

function normalizeLocalPost(post: LocalPost): LocalPost {
  const type = post.type ?? (post.contentType ?? (post.format === 'short' ? 'short' : 'video'))
  const isDraft = post.isDraft === true || post.status === 'draft' || post.isPublished === false
  return {
    ...post,
    type,
    contentType: post.contentType ?? type,
    isDraft,
    isPublished: !isDraft,
    status: isDraft ? 'draft' : 'published',
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support local video storage.'))
      return
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE)
      }
      if (!database.objectStoreNames.contains(POST_STORE)) {
        database.createObjectStore(POST_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local video storage could not be opened.'))
    request.onblocked = () => reject(new Error('Local video storage is busy in another tab.'))
  })
}

async function writeLocalPost(post: LocalPost, file: File) {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([MEDIA_STORE, POST_STORE], 'readwrite')
      transaction.objectStore(MEDIA_STORE).put(file, post.localMediaId)
      transaction.objectStore(POST_STORE).put(post)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('The upload could not be saved on this device.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('The upload could not be saved on this device.'))
    })
  } finally {
    database.close()
  }
}

async function readVideo(id: string): Promise<Blob | undefined> {
  const database = await openDatabase()
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(MEDIA_STORE, 'readonly').objectStore(MEDIA_STORE).get(id)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error ?? new Error('A saved video could not be read.'))
    })
  } finally {
    database.close()
  }
}

async function readIndexedDbPosts(): Promise<LocalPost[]> {
  const database = await openDatabase()
  try {
    return await new Promise<LocalPost[]>((resolve, reject) => {
      const request = database.transaction(POST_STORE, 'readonly').objectStore(POST_STORE).getAll()
      request.onsuccess = () => resolve(request.result.filter(isLocalPost).map(normalizeLocalPost))
      request.onerror = () => reject(request.error ?? new Error('Saved post details could not be read.'))
    })
  } finally {
    database.close()
  }
}

export async function saveLocalPost(post: LocalPost, file: File) {
  if (
    post.type !== post.contentType ||
    (post.type === 'short') !== (post.format === 'short') ||
    post.isShort !== (post.type === 'short') ||
    post.isLongVideo !== (post.type === 'video')
  ) {
    throw new Error('The upload type does not match its saved content format.')
  }
  await writeLocalPost(post, file)
  try {
    window.localStorage.setItem(`${POST_PREFIX}${post.id}`, JSON.stringify(post))
  } catch {
    // IndexedDB is the primary copy; localStorage remains a legacy-compatible mirror.
  }
}

export async function deleteLocalPost(id: string) {
  const storageKey = `${POST_PREFIX}${id}`
  let storedPost: string | null
  try {
    storedPost = window.localStorage.getItem(storageKey)
    window.localStorage.removeItem(storageKey)
  } catch (error) {
    throw new Error(`The saved upload could not be removed from browser storage: ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    const database = await openDatabase()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction([MEDIA_STORE, POST_STORE], 'readwrite')
        const mediaStore = transaction.objectStore(MEDIA_STORE)
        const postStore = transaction.objectStore(POST_STORE)
        const postRequest = postStore.get(id)
        postStore.delete(id)
        postRequest.onsuccess = () => {
          const post = postRequest.result
          mediaStore.delete(isLocalPost(post) ? post.localMediaId : id)
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('The saved media could not be deleted from this device.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('The saved media could not be deleted from this device.'))
      })
    } finally {
      database.close()
    }
  } catch (error) {
    if (storedPost) {
      try {
        window.localStorage.setItem(storageKey, storedPost)
      } catch (restoreError) {
        throw new Error(
          `The saved media could not be deleted: ${error instanceof Error ? error.message : String(error)}. ` +
          `Its localStorage copy could not be restored: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
        )
      }
    }
    throw error
  }
}

export function readLocalPost(id: string): LocalPost | null {
  const value = window.localStorage.getItem(`${POST_PREFIX}${id}`)
  if (!value) return null
  const parsed: unknown = JSON.parse(value)
  return isLocalPost(parsed) ? normalizeLocalPost(parsed) : null
}

export async function updateLocalPost(
  id: string,
  update: Pick<LocalPost, 'title' | 'description' | 'caption' | 'visibility'>,
) {
  const indexedPosts = await readIndexedDbPosts()
  const post = indexedPosts.find((candidate) => candidate.id === id) ?? readLocalPost(id)
  if (!post) throw new Error('This upload is no longer available on this device.')
  const nextPost = { ...post, ...update }
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(POST_STORE, 'readwrite')
      transaction.objectStore(POST_STORE).put(nextPost)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('The upload details could not be updated.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('The upload details could not be updated.'))
    })
  } finally {
    database.close()
  }
  try {
    window.localStorage.setItem(`${POST_PREFIX}${id}`, JSON.stringify(nextPost))
  } catch {
    // Keep the IndexedDB copy authoritative when localStorage is unavailable.
  }
}

function readLocalStoragePosts() {
  const posts: LocalPost[] = []
  try {
    const storage = window.localStorage
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key?.startsWith(POST_PREFIX)) continue
      const value = storage.getItem(key)
      if (!value) continue
      try {
        const parsed: unknown = JSON.parse(value)
        if (isLocalPost(parsed)) posts.push(normalizeLocalPost(parsed))
      } catch {
        continue
      }
    }
  } catch {
    return { posts, error: 'Browser local storage is unavailable.' }
  }
  return { posts, error: '' }
}

export async function loadLocalPosts(
  includePost: (post: LocalPost) => boolean = () => true,
): Promise<LocalPost[]> {
  const localResult = readLocalStoragePosts()
  let indexedPosts: LocalPost[] = []
  let indexedError = ''
  try {
    indexedPosts = await readIndexedDbPosts()
  } catch (error) {
    indexedError = error instanceof Error ? error.message : 'IndexedDB post details could not be loaded.'
  }
  if (localResult.error && indexedError) {
    throw new Error(`${localResult.error} ${indexedError}`)
  }

  const candidates = new Map<string, LocalPost>()
  for (const post of localResult.posts) candidates.set(post.id, normalizeLocalPost(post))
  for (const post of indexedPosts) candidates.set(post.id, post)

  const posts: LocalPost[] = []
  for (const candidate of candidates.values()) {
    if (!includePost(candidate)) continue
    let blob: Blob | undefined
    try {
      blob = await readVideo(candidate.localMediaId)
    } catch (error) {
      releaseLocalPostUrls(posts)
      if (!candidate.videoSource) {
        if (!localResult.posts.length && !indexedPosts.length) throw error
        continue
      }
    }
    const videoSource = blob ? URL.createObjectURL(blob) : candidate.videoSource
    if (!videoSource) continue
    posts.push({ ...candidate, videoSource, media: { url: videoSource } })
  }
  return posts.sort((first, second) => second.createdAt - first.createdAt)
}

export function releaseLocalPostUrls(posts: LocalPost[]) {
  for (const post of posts) {
    if (post.videoSource?.startsWith('blob:')) URL.revokeObjectURL(post.videoSource)
  }
}
