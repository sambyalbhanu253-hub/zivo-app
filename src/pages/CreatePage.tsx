import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loadLocalPosts,
  releaseLocalPostUrls,
  deleteLocalPost,
  saveLocalPost,
  type LocalPost,
  type PostVisibility,
} from '../lib/localPosts'
import { trimVideoFile } from '../lib/trimVideo'

type StudioMode = 'video' | 'short' | 'live' | 'post'
type StudioStep = 'capture' | 'trim' | 'review' | 'publish'
type StudioPanel = 'ai' | null
type IconName = 'x' | 'sparkles' | 'chevron' | 'image' | 'check' | 'back' | 'wand' | 'video' | 'trim' | 'trash' | 'sound' | 'text' | 'filter' | 'beauty' | 'edit'

function StudioIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const shared = {
    'aria-hidden': true as const,
    fill: 'none',
    height: size,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    width: size,
  }
  const paths: Record<IconName, ReactNode> = {
    x: <><path d="m18 6-12 12M6 6l12 12" /></>,
    sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 15 1.1 2.9L23 19l-2.9 1.1L19 23l-1.1-2.9L15 19l2.9-1.1z" /></>,
    chevron: <><path d="m7 10 5 5 5-5" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    back: <><path d="M19 12H5m7 7-7-7 7-7" /></>,
    wand: <><path d="m15 4 5 5M4 20 17 7m-8 1 1-3 1 3 3 1-3 1-1 3-1-3-3-1z" /></>,
    video: <><rect x="3" y="5" width="14" height="14" rx="3" /><path d="m17 10 4-3v10l-4-3" /></>,
    trim: <><path d="M4 7h16M4 17h16M7 4v6m10 4v6" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    sound: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" /></>,
    text: <><path d="M4 7V4h16v3M12 4v16m-4 0h8" /></>,
    filter: <><path d="M4 5h16l-6 7v6l-4 2v-8z" /></>,
    beauty: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 15 1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1z" /></>,
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19.7 7.8a2.1 2.1 0 0 0-3-3z" /><path d="m14.8 6.7 3 3" /></>,
  }
  return <svg {...shared}>{paths[name]}</svg>
}

const modeLabels: { id: StudioMode; label: string }[] = [
  { id: 'video', label: 'Video' },
  { id: 'short', label: 'Short' },
  { id: 'live', label: 'Live' },
  { id: 'post', label: 'Post' },
]
function makeMediaId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatTrimTime(seconds: number) {
  const centiseconds = Math.floor((seconds % 1) * 100)
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function readAiText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ''
  const record = value as Record<string, unknown>
  for (const key of ['text', 'completion', 'output', 'content', 'response']) {
    if (typeof record[key] === 'string' && record[key].trim()) return (record[key] as string).trim()
  }
  if (typeof record.result === 'string' && record.result.trim()) return record.result.trim()
  if (typeof record.result === 'object' && record.result !== null && !Array.isArray(record.result)) {
    return readAiText(record.result)
  }
  return ''
}

export default function CreatePage() {
  const navigate = useNavigate()
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const shortTrimVideoRef = useRef<HTMLVideoElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const liveStreamRef = useRef<MediaStream | null>(null)
  const previewUrlRef = useRef('')
  const generatedUploadUrlsRef = useRef(new Set<string>())
  const [mode, setMode] = useState<StudioMode>('video')
  const [step, setStep] = useState<StudioStep>('capture')
  const [panel, setPanel] = useState<StudioPanel>(null)
  const [shortMuted, setShortMuted] = useState(false)
  const [shortTextOverlay, setShortTextOverlay] = useState(false)
  const [shortFilter, setShortFilter] = useState<'none' | 'warm' | 'mono'>('none')
  const [shortBeauty, setShortBeauty] = useState(false)
  const [videoDuration, setVideoDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [trimReturnToDetails, setTrimReturnToDetails] = useState(false)
  const [madeForKids, setMadeForKids] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResult, setAiResult] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [visibility, setVisibility] = useState<PostVisibility>('public')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [recentUploads, setRecentUploads] = useState<LocalPost[]>([])
  const [galleryError, setGalleryError] = useState('')
  const [postText, setPostText] = useState('')
  const [pollEnabled, setPollEnabled] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [liveTitle, setLiveTitle] = useState('')
  const [liveVisibility, setLiveVisibility] = useState<PostVisibility>('public')
  const [liveNext, setLiveNext] = useState(false)
  const [livePreviewStatus, setLivePreviewStatus] = useState<'idle' | 'starting' | 'camera' | 'mock'>('idle')
  const [livePreviewError, setLivePreviewError] = useState('')
  useEffect(() => {
    const video = liveVideoRef.current
    if (liveNext && livePreviewStatus === 'camera' && video && liveStreamRef.current) {
      video.srcObject = liveStreamRef.current
    } else if (video) {
      video.srcObject = null
    }
  }, [liveNext, livePreviewStatus])

  useEffect(() => {
    let cancelled = false
    let posts: LocalPost[] = []
    void loadLocalPosts()
      .then((loaded) => {
        if (cancelled) {
          releaseLocalPostUrls(loaded)
          return
        }
        posts = loaded
        setRecentUploads(loaded)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setGalleryError(`Your saved media could not be loaded: ${reason instanceof Error ? reason.message : String(reason)}`)
      })
    return () => {
      cancelled = true
      releaseLocalPostUrls(posts)
    }
  }, [])

  useEffect(() => () => {
    liveStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    generatedUploadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const isImage = Boolean(mediaFile?.type.startsWith('image/'))
  const clearMedia = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previewUrlRef.current = ''
    setPreviewUrl('')
    setMediaFile(null)
    setCaption('')
    setTitle('')
    setDescription('')
    setHashtags('')
    setShortMuted(false)
    setShortTextOverlay(false)
    setShortFilter('none')
    setShortBeauty(false)
    setVideoDuration(0)
    setTrimStart(0)
    setTrimEnd(0)
    setMadeForKids(false)
    setSavedMessage('')
    setStep('capture')
  }, [previewUrl])

  const openMedia = (file: File) => {
    const isAllowed = mode === 'post'
      ? file.type.startsWith('image/')
      : file.type.startsWith('video/')
    if (!isAllowed) {
      setError(mode === 'post' ? 'Choose an image for your post.' : 'Choose a video to continue.')
      return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    setError('')
    setMediaFile(file)
    setVideoDuration(0)
    setTrimStart(0)
    setTrimEnd(0)
    const nextPreviewUrl = URL.createObjectURL(file)
    previewUrlRef.current = nextPreviewUrl
    setPreviewUrl(nextPreviewUrl)
    setCaption(mode === 'post' ? postText : '')
    setTitle(mode === 'post' ? postText.slice(0, 80) : file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
    setDescription('')
    setHashtags('')
    setShortMuted(false)
    setShortTextOverlay(false)
    setShortFilter('none')
    setShortBeauty(false)
    setMadeForKids(false)
    if (mode === 'short') setVisibility('public')
    setStep(mode === 'short' ? 'trim' : mode === 'post' ? 'capture' : 'review')
  }

  const chooseMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    openMedia(file)
  }

  const generateAiIdea = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) {
      setError('Add a few words about your video first.')
      return
    }
    setIsGenerating(true)
    setError('')
    setAiResult('')
    try {
      const response = await fetch('/api/ai/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `For a social video creator, write one concise, engaging caption for this idea: ${prompt}`,
        }),
      })
      if (!response.ok) throw new Error(`AI service returned ${response.status}.`)
      const result = readAiText(await response.json())
      if (!result) throw new Error('The AI service returned no text. Please try a different prompt.')
      setAiResult(result)
    } catch (reason) {
      setError(`AI idea could not be generated: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const selectMedia = () => {
    if (mode === 'post' && pollEnabled) {
      setError('Remove the poll before adding an image. Polls are available on text updates.')
      return
    }
    setPanel(null)
    if (mediaInputRef.current) mediaInputRef.current.accept = mode === 'post' ? 'image/*' : 'video/*'
    mediaInputRef.current?.click()
  }

  const selectRecentUpload = async (post: LocalPost) => {
    if (!post.videoSource) return
    try {
      const response = await fetch(post.videoSource)
      if (!response.ok) throw new Error(`Saved media returned ${response.status}.`)
      const blob = await response.blob()
      const type = blob.type || (post.contentType === 'image' ? 'image/jpeg' : 'video/mp4')
      const extension = type.startsWith('image/') ? 'jpg' : 'mp4'
      openMedia(new File([blob], `${post.title || 'pulse-media'}.${extension}`, { type }))
    } catch (reason) {
      setError(`This saved video could not be opened: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }

  const saveShort = async (draft: boolean) => {
    if (!mediaFile || mode !== 'short') return
    setIsSaving(true)
    setError('')
    try {
      const trimResult = await trimVideoFile(mediaFile, trimStart, trimEnd)
      const trimmedFile = trimResult.file
      const mediaId = makeMediaId()
      const finalCaption = caption.trim()
      const post: LocalPost = {
        id: mediaId,
        title: title.trim() || mediaFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        description: description.trim(),
        caption: finalCaption,
        hashtags: hashtags.trim(),
        format: 'short',
        type: 'short',
        contentType: 'short',
        visibility: draft ? 'private' : visibility,
        creatorId: 'local-creator',
        creatorName: 'You',
        creatorHandle: 'you',
        createdAt: Date.now(),
        localMediaId: mediaId,
        videoSource: previewUrl,
        media: { url: previewUrl },
        trimStart: trimResult.startTime,
        trimEnd: trimResult.endTime,
        isShort: true,
        isLongVideo: false,
        madeForKids,
        isDraft: draft,
        isPublished: !draft,
        status: draft ? 'draft' : 'published',
        category: 'Other',
        likesCount: 0,
        viewsCount: 0,
      }
      await saveLocalPost(post, trimmedFile)
      const savedPreviewUrl = URL.createObjectURL(trimmedFile)
      generatedUploadUrlsRef.current.add(savedPreviewUrl)
      const galleryPost = { ...post, videoSource: savedPreviewUrl, media: { url: savedPreviewUrl } }
      setRecentUploads((uploads) => [galleryPost, ...uploads.filter((upload) => upload.id !== post.id)])
      setSavedMessage(draft
        ? 'Saved as a private draft on this device.'
        : visibility === 'public'
          ? 'Your Short is public on this device.'
          : 'Your Short is saved as unlisted on this device.')
      setStep('publish')
    } catch (reason) {
      setError(`Your Short could not be saved: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const publish = async () => {
    if (!mediaFile) return
    setIsSaving(true)
    setError('')
    try {
      const finalCaption = (mode === 'post' ? postText : caption).trim() || title.trim() || mediaFile.name
      const mediaId = makeMediaId()
      const isShort = !isImage && mode === 'short'
      const post: LocalPost = {
        id: mediaId,
        title: title.trim() || finalCaption.slice(0, 80),
        description: finalCaption,
        caption: finalCaption,
        format: isShort ? 'short' : 'long',
        type: isImage ? 'image' : isShort ? 'short' : 'video',
        contentType: isImage ? 'image' : isShort ? 'short' : 'video',
        visibility,
        creatorId: 'local-creator',
        creatorName: 'You',
        creatorHandle: 'you',
        createdAt: Date.now(),
        localMediaId: mediaId,
        videoSource: previewUrl,
        media: { url: previewUrl },
        isShort,
        isLongVideo: !isImage && !isShort,
        isDraft: false,
        isPublished: true,
        status: 'published',
        madeForKids: false,
        category: isImage ? 'Photo' : 'Other',
        likesCount: 0,
        viewsCount: 0,
      }
      await saveLocalPost(post, mediaFile)
      setSavedMessage(visibility === 'public'
        ? 'Published to your public PULSE feed on this device.'
        : 'Saved privately on this device.')
      setStep('publish')
    } catch (reason) {
      setError(`Your post could not be saved: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const changeMode = (nextMode: StudioMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    setPanel(null)
    setError('')
    setLiveNext(false)
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((track) => track.stop())
      liveStreamRef.current = null
    }
    setLivePreviewStatus('idle')
    setLivePreviewError('')
  }

  const startLivePreview = async () => {
    liveStreamRef.current?.getTracks().forEach((track) => track.stop())
    liveStreamRef.current = null
    setLivePreviewError('')
    setLivePreviewStatus('starting')
    setLiveNext(true)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is unavailable in this browser.')
      }
      liveStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      setLivePreviewStatus('camera')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setLivePreviewError(`Camera preview unavailable: ${message} Showing a simulated local preview instead.`)
      setLivePreviewStatus('mock')
    }
  }

  const stopLivePreview = () => {
    liveStreamRef.current?.getTracks().forEach((track) => track.stop())
    liveStreamRef.current = null
    setLivePreviewStatus('idle')
    setLivePreviewError('')
    setLiveNext(false)
  }

  const saveTextUpdate = () => {
    const text = postText.trim()
    const options = pollOptions.map((option) => option.trim()).filter(Boolean)
    if (!text && !(pollEnabled && pollQuestion.trim())) {
      setError('Write an update or add a poll question first.')
      return
    }
    if (pollEnabled && (options.length < 2 || options.length !== pollOptions.length)) {
      setError('Add an answer for each poll option.')
      return
    }
    const update = {
      id: makeMediaId(),
      text,
      poll: pollEnabled ? { question: pollQuestion.trim(), options } : null,
      visibility: 'private' as const,
      createdAt: Date.now(),
    }
    try {
      window.localStorage.setItem(`pulse:post:update:${update.id}`, JSON.stringify(update))
      setSavedMessage('Your update is saved on this device.')
      setError('')
    } catch (reason) {
      setError(`Your update could not be saved: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }

  const videoUploads = recentUploads.filter((post) => post.type === 'video')
  const shortUploads = recentUploads.filter((post) => post.type === 'short')

  const removeUpload = async (post: LocalPost) => {
    setRecentUploads((uploads) => uploads.filter((upload) => upload.id !== post.id))
    setGalleryError('')
    try {
      await deleteLocalPost(post.id)
      releaseLocalPostUrls([post])
      if (post.videoSource && generatedUploadUrlsRef.current.delete(post.videoSource)) {
        URL.revokeObjectURL(post.videoSource)
      }
    } catch (reason) {
      setRecentUploads((uploads) => uploads.some((upload) => upload.id === post.id)
        ? uploads
        : [...uploads, post].sort((first, second) => second.createdAt - first.createdAt))
      setGalleryError(`This upload could not be deleted: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }

  const continueShortToDetails = () => {
    if (!mediaFile) return
    setError('')
    setTrimReturnToDetails(false)
    setStep('publish')
  }

  const returnFromTrim = () => {
    if (trimReturnToDetails) {
      setTrimReturnToDetails(false)
      setStep('publish')
      return
    }
    clearMedia()
  }

  const minimumTrimGap = videoDuration > 0 ? Math.min(0.1, videoDuration) : 0
  const selectedDuration = Math.max(0, trimEnd - trimStart)
  const setTrimPreviewTime = (time: number) => {
    const video = shortTrimVideoRef.current
    if (video && Number.isFinite(video.duration)) video.currentTime = time
  }
  const updateTrimStart = (value: number) => {
    const nextStart = Math.max(0, Math.min(value, trimEnd - minimumTrimGap))
    setTrimStart(nextStart)
    setTrimPreviewTime(nextStart)
  }
  const updateTrimEnd = (value: number) => {
    setTrimEnd(Math.max(trimStart + minimumTrimGap, Math.min(value, videoDuration)))
  }
  const handleTrimMetadata = (video: HTMLVideoElement) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return
    setVideoDuration(video.duration)
    setTrimEnd((current) => current > 0 ? Math.min(current, video.duration) : video.duration)
    video.currentTime = Math.min(trimStart, video.duration)
  }
  const handleTrimPlayback = (video: HTMLVideoElement) => {
    if (trimEnd > trimStart && video.currentTime >= trimEnd) {
      video.currentTime = trimStart
    }
  }

  return (
    <section aria-label="PULSE creator studio" className={`creator-studio mode-${mode}`}>
      {step === 'capture' && mode === 'video' && (
        <div className="studio-video-library">
          <header className="studio-library-header">
            <button aria-label="Exit creator studio" className="studio-icon-button" onClick={() => navigate('/')} type="button">
              <StudioIcon name="x" size={22} />
            </button>
            <span>Video</span>
            <span aria-hidden="true" className="studio-header-spacer" />
          </header>
          <div className="studio-library-content">
            <p className="studio-step-kicker">MAKE SOMETHING WORTH WATCHING</p>
            <h1>Choose a video</h1>
            <p className="studio-library-description">Start with a video from your device or pick one you’ve already shared.</p>
            <button className="studio-select-video" onClick={selectMedia} type="button">
              <StudioIcon name="video" size={20} />
              <span>Select from video</span>
              <StudioIcon name="chevron" size={18} />
            </button>
            <div className="studio-library-section-heading">
              <h2>Your videos</h2>
              <span>{videoUploads.length ? `${videoUploads.length} saved` : 'On this device'}</span>
            </div>
            {galleryError && <p aria-live="polite" className="studio-error">{galleryError}</p>}
            {videoUploads.length ? (
              <div aria-label="Previously shared videos" className="studio-gallery-grid">
                {videoUploads.map((post) => (
                  <div className="studio-gallery-card" key={post.id}>
                    <button
                      aria-label={`Use ${post.title}`}
                      className="studio-gallery-card-use"
                      onClick={() => void selectRecentUpload(post)}
                      type="button"
                    >
                      <video muted playsInline preload="metadata" src={post.videoSource} />
                    </button>
                    <span className="studio-gallery-card-title">{post.title}</span>
                    <span className="studio-gallery-card-type">Video</span>
                    <button
                      aria-label={`Delete ${post.title}`}
                      className="studio-gallery-card-delete"
                      onClick={() => void removeUpload(post)}
                      type="button"
                    >
                      <StudioIcon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button aria-label="Browse for a video" className="studio-gallery-empty" onClick={selectMedia} type="button">
                <span className="studio-gallery-empty-icon"><StudioIcon name="image" size={24} /></span>
                <span>Videos you choose will appear here</span>
                <span className="studio-gallery-empty-tiles" aria-hidden="true"><i /><i /><i /></span>
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'capture' && mode === 'live' && (
        <div className="studio-live-setup">
          <header className="studio-library-header">
            <button aria-label="Exit creator studio" className="studio-icon-button" onClick={() => navigate('/')} type="button">
              <StudioIcon name="x" size={22} />
            </button>
            <span>Live</span>
            <span aria-hidden="true" className="studio-header-spacer" />
          </header>
          {!liveNext ? (
            <div className="studio-live-content">
              <div aria-label="Live preview" className="studio-live-preview">
                <span className="studio-live-preview-icon"><StudioIcon name="video" size={26} /></span>
                <span className="studio-live-preview-label">LIVE PREVIEW</span>
                <p>Your stream preview will appear here</p>
              </div>
              <div className="studio-live-fields">
                <label htmlFor="studio-live-title">Stream title</label>
                <input
                  id="studio-live-title"
                  maxLength={100}
                  onChange={(event) => setLiveTitle(event.target.value)}
                  placeholder="What are you going live about?"
                  value={liveTitle}
                />
                <label htmlFor="studio-live-privacy">Who can watch?</label>
                <select id="studio-live-privacy" onChange={(event) => setLiveVisibility(event.target.value as PostVisibility)} value={liveVisibility}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
                <p>Next starts a local preview. You can check your camera before going live.</p>
              </div>
              <button className="studio-live-next" onClick={() => void startLivePreview()} type="button">Next</button>
            </div>
          ) : (
            <div className="studio-live-content studio-live-confirm">
              <div aria-label={livePreviewStatus === 'camera' ? 'Camera live preview' : 'Simulated live preview'} className="studio-live-preview">
                {livePreviewStatus === 'camera'
                  ? <video autoPlay className="studio-live-video" muted playsInline ref={liveVideoRef} />
                  : <span className="studio-live-preview-icon"><StudioIcon name="video" size={26} /></span>}
                <span className="studio-live-preview-label">{liveVisibility.toUpperCase()}</span>
                <span className={`studio-live-state${livePreviewStatus === 'camera' ? ' is-live' : ''}`}>
                  <span className="studio-live-dot" />
                  {livePreviewStatus === 'starting'
                    ? 'Starting preview'
                    : livePreviewStatus === 'camera'
                      ? 'Camera preview'
                      : 'Simulated preview'}
                </span>
                <h1>{liveTitle.trim() || 'Your live stream'}</h1>
              </div>
              <p role="status">
                {livePreviewError || 'Local preview only. PULSE broadcasting is not connected, so this preview is not public.'}
              </p>
              <button className="studio-live-next" onClick={stopLivePreview} type="button">End preview</button>
            </div>
          )}
        </div>
      )}

      {step === 'capture' && mode === 'post' && (
        <div className="studio-post-composer">
          <header className="studio-library-header">
            <button aria-label="Exit creator studio" className="studio-icon-button" onClick={() => navigate('/')} type="button">
              <StudioIcon name="x" size={22} />
            </button>
            <span>Create a post</span>
            <span aria-hidden="true" className="studio-header-spacer" />
          </header>
          {savedMessage ? (
            <div className="studio-post-saved" role="status">
              <span className="studio-published-check"><StudioIcon name="check" size={27} /></span>
              <h1>Update saved</h1>
              <p>{savedMessage}</p>
              <button className="studio-primary-button" onClick={() => {
                setSavedMessage('')
                setPostText('')
                setPollEnabled(false)
                setPollQuestion('')
                setPollOptions(['', ''])
              }} type="button">Write another</button>
            </div>
          ) : (
            <form className="studio-post-content" onSubmit={(event) => {
              event.preventDefault()
              if (mediaFile) void publish()
              else saveTextUpdate()
            }}>
              <label className="studio-post-prompt" htmlFor="studio-post-text">What’s on your mind?</label>
              <textarea
                id="studio-post-text"
                maxLength={2200}
                onChange={(event) => setPostText(event.target.value)}
                placeholder="Share a thought with your community…"
                rows={6}
                value={postText}
              />
              <div className="studio-post-meta"><span>Text update</span><span>{postText.length}/2200</span></div>
              {mediaFile && previewUrl && (
                <div className="studio-post-attachment">
                  <img alt="Selected post attachment" src={previewUrl} />
                  <button aria-label="Remove image" className="studio-attachment-remove" onClick={clearMedia} type="button">
                    <StudioIcon name="x" size={17} />
                  </button>
                </div>
              )}
              <div className="studio-post-options">
                <button className="studio-post-option" onClick={selectMedia} type="button">
                  <StudioIcon name="image" size={19} /> <span>Add image</span>
                </button>
                <button className={`studio-post-option${pollEnabled ? ' is-active' : ''}`} disabled={Boolean(mediaFile)} onClick={() => setPollEnabled((current) => !current)} type="button">
                  <StudioIcon name="check" size={19} /> <span>{pollEnabled ? 'Remove poll' : 'Add poll'}</span>
                </button>
              </div>
              {pollEnabled && (
                <div className="studio-poll-fields">
                  <label htmlFor="studio-poll-question">Poll question</label>
                  <input id="studio-poll-question" maxLength={180} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Ask your community…" value={pollQuestion} />
                  {pollOptions.map((option, index) => (
                    <label className="studio-poll-option" key={index}>
                      <span>Option {index + 1}</span>
                      <input
                        maxLength={100}
                        onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                        placeholder={`Answer ${index + 1}`}
                        value={option}
                      />
                    </label>
                  ))}
                </div>
              )}
              <p className="studio-post-note">Text and poll updates are saved privately on this device. Sharing them to a public feed isn’t connected yet.</p>
              {error && <p aria-live="polite" className="studio-error">{error}</p>}
              <button className="studio-primary-button studio-post-submit" type="submit">
                {mediaFile ? 'Publish image post' : 'Save update'}
              </button>
            </form>
          )}
        </div>
      )}

      {step === 'capture' && mode === 'short' && (
        <div className="studio-video-library">
          <header className="studio-library-header">
            <button aria-label="Exit creator studio" className="studio-icon-button" onClick={() => navigate('/')} type="button">
              <StudioIcon name="x" size={22} />
            </button>
            <span>Short</span>
            <span aria-hidden="true" className="studio-header-spacer" />
          </header>
          <div className="studio-library-content">
            <p className="studio-step-kicker">CREATE A SHORT</p>
            <h1>Choose a video</h1>
            <p className="studio-library-description">Upload a video from your device or choose one you’ve already shared.</p>
            <button className="studio-select-video" onClick={selectMedia} type="button">
              <StudioIcon name="video" size={20} />
              <span>Upload a video</span>
              <StudioIcon name="chevron" size={18} />
            </button>
            <div className="studio-library-section-heading">
              <h2>Your Shorts</h2>
              <span>{shortUploads.length ? `${shortUploads.length} saved` : 'On this device'}</span>
            </div>
            {galleryError && <p aria-live="polite" className="studio-error">{galleryError}</p>}
            {shortUploads.length ? (
              <div aria-label="Previously shared Shorts" className="studio-gallery-grid">
                {shortUploads.map((post) => (
                  <div className="studio-gallery-card" key={post.id}>
                    <button
                      aria-label={`Use ${post.title}`}
                      className="studio-gallery-card-use"
                      onClick={() => void selectRecentUpload(post)}
                      type="button"
                    >
                      <video muted playsInline preload="metadata" src={post.videoSource} />
                    </button>
                    <span className="studio-gallery-card-title">{post.title}</span>
                    <span className="studio-gallery-card-type">Short</span>
                    <button
                      aria-label={`Delete ${post.title}`}
                      className="studio-gallery-card-delete"
                      onClick={() => void removeUpload(post)}
                      type="button"
                    >
                      <StudioIcon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button aria-label="Browse for a video" className="studio-gallery-empty" onClick={selectMedia} type="button">
                <span className="studio-gallery-empty-icon"><StudioIcon name="image" size={24} /></span>
                <span>Videos you choose will appear here</span>
                <span className="studio-gallery-empty-tiles" aria-hidden="true"><i /><i /><i /></span>
              </button>
            )}
            {error && <p aria-live="polite" className="studio-error">{error}</p>}
          </div>
        </div>
      )}

      {step === 'capture' && (
        <nav aria-label="Creation mode" className="studio-mode-switcher" role="tablist">
          {modeLabels.map(({ id, label }) => (
            <button
              aria-selected={mode === id}
              className={`studio-mode-tab${mode === id ? ' is-active' : ''}`}
              key={id}
              onClick={() => changeMode(id)}
              role="tab"
              type="button"
            >{label}</button>
          ))}
          <span aria-hidden="true" className={`studio-mode-indicator mode-${mode}`} />
        </nav>
      )}

      {step === 'trim' && mode === 'short' && mediaFile && (
        <div className="short-wizard short-wizard-trim">
          <header className="short-wizard-header">
            <button
              aria-label={trimReturnToDetails ? 'Back to Add details' : 'Back to Shorts'}
              className="studio-icon-button"
              onClick={returnFromTrim}
              type="button"
            >
              <StudioIcon name="back" />
            </button>
            <div><span>Step 1 of 3</span><strong>Preview your Short</strong></div>
            <span aria-hidden="true" className="short-wizard-header-spacer" />
          </header>
          <div className="short-trim-preview">
            <video
              autoPlay
              className="short-preview-video"
              playsInline
              ref={shortTrimVideoRef}
              src={previewUrl}
              onLoadedMetadata={(event) => handleTrimMetadata(event.currentTarget)}
              onTimeUpdate={(event) => handleTrimPlayback(event.currentTarget)}
              onEnded={(event) => {
                event.currentTarget.currentTime = trimStart
                void event.currentTarget.play().catch((reason: unknown) => {
                  setError(`Video preview could not be resumed: ${reason instanceof Error ? reason.message : String(reason)}`)
                })
              }}
            />
          </div>
          <section aria-label="Short video" className="short-trim-controls">
            <div className="short-trim-label">
              <div><StudioIcon name="trim" size={17} /><strong>Trim your Short</strong></div>
              <span>{formatTrimTime(selectedDuration)} selected</span>
            </div>
            <div
              aria-label="Video trim timeline"
              className="short-trim-timeline"
            >
              <span
                aria-hidden="true"
                className="short-trim-selection"
                style={{
                  left: `${videoDuration > 0 ? trimStart / videoDuration * 100 : 0}%`,
                  width: `${videoDuration > 0 ? selectedDuration / videoDuration * 100 : 100}%`,
                }}
              />
              <input
                aria-label="Trim start"
                aria-valuetext={formatTrimTime(trimStart)}
                className="short-trim-range short-trim-range-start"
                disabled={!videoDuration}
                max={Math.max(0, trimEnd - minimumTrimGap)}
                min={0}
                onChange={(event) => updateTrimStart(Number(event.target.value))}
                step="0.01"
                type="range"
                value={Math.min(trimStart, Math.max(0, trimEnd - minimumTrimGap))}
              />
              <input
                aria-label="Trim end"
                aria-valuetext={formatTrimTime(trimEnd)}
                className="short-trim-range short-trim-range-end"
                disabled={!videoDuration}
                max={videoDuration}
                min={Math.min(videoDuration, trimStart + minimumTrimGap)}
                onChange={(event) => updateTrimEnd(Number(event.target.value))}
                step="0.01"
                type="range"
                value={Math.min(videoDuration, Math.max(trimStart + minimumTrimGap, trimEnd))}
              />
            </div>
            <div className="short-trim-times">
              <span>Start {formatTrimTime(trimStart)}</span>
              <span>End {formatTrimTime(trimEnd)}</span>
            </div>
            <p aria-live="polite" className="short-trim-loading">
              {videoDuration > 0
                ? `${formatTrimTime(trimStart)} – ${formatTrimTime(trimEnd)} of ${formatTrimTime(videoDuration)}`
                : 'Loading video duration…'}
            </p>
          </section>
          {error && <p aria-live="polite" className="studio-error">{error}</p>}
          <div className="short-wizard-footer">
            <button className="studio-primary-button" onClick={continueShortToDetails} type="button">
              Done
            </button>
          </div>
        </div>
      )}

      {step === 'review' && mode === 'short' && mediaFile && (
        <div className="short-wizard short-wizard-edit">
          <header className="short-wizard-header">
            <button aria-label="Back to trim" className="studio-icon-button" onClick={() => setStep('trim')} type="button">
              <StudioIcon name="back" />
            </button>
            <div><span>Step 2 of 3</span><strong>Edit your Short</strong></div>
            <button aria-label="Discard Short" className="studio-icon-button" onClick={clearMedia} type="button">
              <StudioIcon name="x" />
            </button>
          </header>
          <div className="short-edit-stage">
            <video
              autoPlay
              className={`short-preview-video filter-${shortFilter}${shortBeauty ? ' is-beautified' : ''}`}
              muted={shortMuted}
              playsInline
              src={previewUrl}
              onLoadedMetadata={(event) => handleTrimMetadata(event.currentTarget)}
              onTimeUpdate={(event) => handleTrimPlayback(event.currentTarget)}
              onEnded={(event) => {
                event.currentTarget.currentTime = trimStart
                void event.currentTarget.play().catch((reason: unknown) => {
                  setError(`Video preview could not be resumed: ${reason instanceof Error ? reason.message : String(reason)}`)
                })
              }}
            />
            {shortTextOverlay && (
              <span className="short-caption-overlay">{caption.trim() || 'Your caption will appear here'}</span>
            )}
            <div aria-label="Short editing tools" className="short-edit-tools">
              <button aria-pressed={!shortMuted} className="short-edit-tool" onClick={() => setShortMuted((muted) => !muted)} type="button">
                <span><StudioIcon name="sound" size={19} /></span><small>Sound</small>
              </button>
              <button aria-pressed={shortTextOverlay} className="short-edit-tool" onClick={() => setShortTextOverlay((shown) => !shown)} type="button">
                <span><StudioIcon name="text" size={19} /></span><small>Text</small>
              </button>
              <button
                aria-label={`Filter: ${shortFilter}`}
                aria-pressed={shortFilter !== 'none'}
                className="short-edit-tool"
                onClick={() => setShortFilter((filter) => filter === 'none' ? 'warm' : filter === 'warm' ? 'mono' : 'none')}
                type="button"
              >
                <span><StudioIcon name="filter" size={19} /></span><small>Filters</small>
              </button>
              <button aria-pressed={shortBeauty} className="short-edit-tool" onClick={() => setShortBeauty((enabled) => !enabled)} type="button">
                <span><StudioIcon name="beauty" size={19} /></span><small>AI Beauty</small>
              </button>
            </div>
          </div>
          {shortTextOverlay && (
            <label className="short-overlay-input">
              <span>Text overlay</span>
              <input maxLength={2200} onChange={(event) => setCaption(event.target.value)} placeholder="Add text to your Short" value={caption} />
            </label>
          )}
          {error && <p aria-live="polite" className="studio-error">{error}</p>}
          <div className="short-wizard-footer short-edit-footer">
            <button className="studio-secondary-button" onClick={() => setStep('trim')} type="button">Edit</button>
            <button className="studio-primary-button" onClick={continueShortToDetails} type="button">Done <StudioIcon name="chevron" size={17} /></button>
          </div>
        </div>
      )}

      {step === 'publish' && mode === 'short' && mediaFile && (
        <div className="short-wizard short-wizard-details">
          <header className="short-wizard-header">
            <button aria-label="Back to edit" className="studio-icon-button" onClick={() => setStep('review')} type="button">
              <StudioIcon name="back" />
            </button>
            <div><span>Step 3 of 3</span><strong>{savedMessage ? 'Short saved' : 'Add details'}</strong></div>
            <span aria-hidden="true" className="short-wizard-header-spacer" />
          </header>
          {savedMessage ? (
            <div className="short-saved-state" role="status">
              <span className="studio-published-check"><StudioIcon name="check" size={27} /></span>
              <p className="studio-step-kicker">MADE WITH PULSE</p>
              <h1>{savedMessage.startsWith('Saved') ? 'Draft saved' : 'Your Short is ready'}</h1>
              <p>{savedMessage}</p>
              <button className="studio-primary-button" onClick={() => navigate('/shorts')} type="button">View Shorts</button>
              <button className="studio-secondary-button" onClick={clearMedia} type="button">Create another Short</button>
            </div>
          ) : (
            <>
              <div className="short-details-content">
                <div className="short-details-preview">
                  <video
                    autoPlay
                    className={`short-preview-video filter-${shortFilter}${shortBeauty ? ' is-beautified' : ''}`}
                    playsInline
                    preload="auto"
                    src={previewUrl}
                    onLoadedMetadata={(event) => handleTrimMetadata(event.currentTarget)}
                    onTimeUpdate={(event) => handleTrimPlayback(event.currentTarget)}
                    onEnded={(event) => {
                      event.currentTarget.currentTime = trimStart
                      void event.currentTarget.play().catch((reason: unknown) => {
                        setError(`Video preview could not be resumed: ${reason instanceof Error ? reason.message : String(reason)}`)
                      })
                    }}
                  />
                  {shortTextOverlay && <span className="short-caption-overlay">{caption.trim() || 'Your caption'}</span>}
                  <button
                    aria-label="Edit Short preview"
                    className="short-preview-edit"
                    onClick={() => {
                      setTrimReturnToDetails(true)
                      setStep('trim')
                    }}
                    type="button"
                  >
                    <StudioIcon name="edit" size={17} />
                  </button>
                </div>
                <label className="short-detail-field" htmlFor="short-title">
                  <span>Title</span>
                  <input
                    id="short-title"
                    maxLength={100}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Add a title"
                    value={title}
                  />
                </label>
                <label className="short-caption-field" htmlFor="short-caption">
                  <span>Caption</span>
                  <textarea
                    id="short-caption"
                    maxLength={2200}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Caption your Short"
                    rows={4}
                    value={caption}
                  />
                  <small>{caption.length}/2200</small>
                </label>
                <label className="short-detail-field" htmlFor="short-description">
                  <span>Description</span>
                  <textarea
                    id="short-description"
                    maxLength={5000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell viewers a little more"
                    rows={3}
                    value={description}
                  />
                </label>
                <label className="short-detail-field" htmlFor="short-hashtags">
                  <span>Hashtags</span>
                  <input
                    id="short-hashtags"
                    maxLength={500}
                    onChange={(event) => setHashtags(event.target.value)}
                    placeholder="#travel #food #shorts"
                    value={hashtags}
                  />
                </label>
                <section aria-label="Short publishing settings" className="short-details-settings">
                  <div className="short-setting-row">
                    <span><strong>Visibility</strong><small>Choose who can watch your Short</small></span>
                    <select aria-label="Visibility" onChange={(event) => setVisibility(event.target.value as PostVisibility)} value={visibility}>
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <button aria-checked={madeForKids} className="short-setting-row short-audience-row" onClick={() => setMadeForKids((value) => !value)} role="switch" type="button">
                    <span><strong>Audience</strong><small>{madeForKids ? 'Yes, it’s Made for Kids' : 'No, it’s not Made for Kids'}</small></span>
                    <span className={`short-audience-toggle${madeForKids ? ' is-on' : ''}`}><i /></span>
                  </button>
                </section>
                {error && <p aria-live="polite" className="studio-error">{error}</p>}
              </div>
              <div className="short-wizard-footer short-details-footer">
                <button className="studio-secondary-button" disabled={isSaving} onClick={() => void saveShort(true)} type="button">
                  {isSaving ? 'Saving…' : 'Save draft'}
                </button>
                <button className="studio-primary-button" disabled={isSaving} onClick={() => void saveShort(false)} type="button">
                  {isSaving ? 'Uploading…' : 'Upload Short'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'review' && mediaFile && mode !== 'short' && (
        <div className="studio-workspace">
          <header className="studio-editor-topbar">
            <button aria-label="Back to media selection" className="studio-icon-button" onClick={clearMedia} type="button"><StudioIcon name="back" /></button>
            <span>Review your clip</span>
            <button className="studio-next-button" onClick={() => setStep('publish')} type="button">Next <StudioIcon name="chevron" size={16} /></button>
          </header>
          <div className="studio-review-layout">
            <div className={`studio-review-preview${isImage ? ' is-image' : ''}`}>
              {isImage
                ? <img alt="Your selected post" src={previewUrl} />
                : <video controls playsInline src={previewUrl} />}
            </div>
            <div className="studio-review-info">
              <p className="studio-step-kicker">YOUR MOMENT, YOUR WAY</p>
              <h1>One last look.</h1>
              <p>Preview your {isImage ? 'photo' : 'clip'}, then add your caption.</p>
              <div className="studio-review-actions">
                <button className="studio-secondary-button" onClick={selectMedia} type="button"><StudioIcon name="image" size={17} /> Replace media</button>
                <button className="studio-primary-button" onClick={() => setStep('publish')} type="button">Add a caption <StudioIcon name="chevron" size={17} /></button>
              </div>
            </div>
          </div>
          {error && <p aria-live="polite" className="studio-error">{error}</p>}
        </div>
      )}

      {step === 'publish' && mediaFile && mode !== 'short' && (
        <div className="studio-workspace studio-publish-workspace">
          <header className="studio-editor-topbar">
            <button aria-label="Back to review" className="studio-icon-button" onClick={() => setStep('review')} type="button"><StudioIcon name="back" /></button>
            <span>{savedMessage ? 'You’re all set' : 'Share your creation'}</span>
            <span className="studio-step-count">03 <i>/ 03</i></span>
          </header>
          <div className="studio-publish-layout">
            <div className={`studio-publish-preview${isImage ? ' is-image' : ''}`}>
              {isImage
                ? <img alt="Post preview" src={previewUrl} />
                : <video autoPlay loop muted playsInline src={previewUrl} />}
              <span className="studio-publish-preview-tag">{isImage ? 'PHOTO POST' : mode.toUpperCase()}</span>
            </div>
            <form className="studio-publish-form" onSubmit={(event) => {
              event.preventDefault()
              void publish()
            }}>
              {savedMessage ? (
                <div className="studio-published-state">
                  <span className="studio-published-check"><StudioIcon name="check" size={27} /></span>
                  <p className="studio-step-kicker">MADE WITH PULSE</p>
                  <h1>Your story is out there.</h1>
                  <p>{savedMessage}</p>
                  <button className="studio-primary-button" onClick={() => navigate('/')} type="button">Back to PULSE</button>
                  <button className="studio-secondary-button" onClick={() => {
                    clearMedia()
                    setSavedMessage('')
                    changeMode('short')
                  }} type="button">Create another</button>
                </div>
              ) : (
                <>
                  <p className="studio-step-kicker">A LITTLE CONTEXT GOES A LONG WAY</p>
                  <h1>Set the scene.</h1>
                  <label className="studio-field-label" htmlFor="studio-title">Title</label>
                  <input
                    id="studio-title"
                    maxLength={100}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Give your creation a name"
                    value={title}
                  />
                  <label className="studio-field-label" htmlFor="studio-caption">Caption</label>
                  <textarea
                    id="studio-caption"
                    maxLength={2200}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="What’s the story behind this moment?"
                    rows={5}
                    value={caption}
                  />
                  <div className="studio-caption-tools">
                    <button aria-expanded={panel === 'ai'} onClick={() => setPanel(panel === 'ai' ? null : 'ai')} type="button">
                      <StudioIcon name="sparkles" size={16} /> AI caption ideas
                    </button>
                    <span>{caption.length}/2200</span>
                  </div>
                  {panel === 'ai' && (
                    <div className="studio-publish-ai">
                      <textarea
                        aria-label="Describe your caption idea"
                        onChange={(event) => setAiPrompt(event.target.value)}
                        placeholder="What’s the feeling, scene, or story?"
                        rows={2}
                        value={aiPrompt}
                      />
                      <button className="studio-panel-action" disabled={isGenerating} onClick={() => void generateAiIdea()} type="button">
                        <StudioIcon name="wand" size={17} /> {isGenerating ? 'Thinking…' : 'Generate a caption'}
                      </button>
                      {aiResult && (
                        <div className="studio-ai-result">
                          <p>{aiResult}</p>
                          <button onClick={() => {
                            setCaption(aiResult)
                            setPanel(null)
                          }} type="button">Use this caption</button>
                        </div>
                      )}
                    </div>
                  )}
                  <label className="studio-field-label" htmlFor="studio-visibility">Who can see this?</label>
                  <select id="studio-visibility" onChange={(event) => setVisibility(event.target.value as PostVisibility)} value={visibility}>
                    <option value="public">Public · visible in your feed on this device</option>
                    <option value="private">Private · saved only on this device</option>
                  </select>
                  <div className="studio-publish-footnote">Your media is saved privately on this device. Public posts appear in this device’s PULSE feed.</div>
                  {error && <p aria-live="polite" className="studio-error">{error}</p>}
                  <button className="studio-primary-button studio-publish-submit" disabled={isSaving} type="submit">
                    {isSaving ? 'Saving…' : visibility === 'public' ? 'Publish on this device' : 'Save privately'}
                    {!isSaving && <StudioIcon name="check" size={18} />}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      <input accept="video/*,image/*" className="studio-hidden-input" onChange={chooseMedia} ref={mediaInputRef} type="file" />
    </section>
  )
}
