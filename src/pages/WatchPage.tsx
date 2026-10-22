import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import LongVideoPlayer from '../components/LongVideoPlayer'
import {
  formatVideoAge,
  formatViews,
  loadLongVideos,
  sampleVideos,
  videoPoster,
  type LongVideo,
} from '../lib/longVideos'

type Reaction = 'like' | 'dislike' | null

function mergeVideos(loadedVideos: LongVideo[]) {
  const uniqueVideos = new Map<string, LongVideo>()
  for (const video of sampleVideos) uniqueVideos.set(video.id, video)
  for (const video of loadedVideos) uniqueVideos.set(video.id, video)
  return [...uniqueVideos.values()]
}

function safeFileName(title: string) {
  return `${title.replace(/[^\w -]/g, '').trim() || 'pulse-video'}.mp4`
}

function formatSubscribers(count?: number) {
  return count === undefined
    ? '—'
    : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count)
}

export default function WatchPage() {
  const { videoId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [videos, setVideos] = useState<LongVideo[]>(sampleVideos)
  const [reaction, setReaction] = useState<Reaction>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [commentsExpanded, setCommentsExpanded] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [recommendationFilter, setRecommendationFilter] = useState('All')

  useEffect(() => {
    setReaction(null)
    setIsSubscribed(false)
    setIsSaved(false)
    setCommentsExpanded(false)
    setActionMessage('')
    setRecommendationFilter('All')
    window.scrollTo(0, 0)
  }, [videoId])

  useEffect(() => {
    let active = true
    let releaseLoadedVideos = () => {}

    void loadLongVideos().then((result) => {
      if (!active) {
        result.release()
        return
      }
      releaseLoadedVideos = result.release
      setVideos(mergeVideos(result.videos))
    })

    return () => {
      active = false
      releaseLoadedVideos()
    }
  }, [])

  const video = videos.find((candidate) => candidate.id === videoId)
  const recommendations = useMemo(() => {
    const available = videos
      .filter((candidate) => candidate.id !== videoId)
      .sort((first, second) => {
      const firstRelated = Number(first.category === video?.category) + Number(first.creator === video?.creator)
      const secondRelated = Number(second.category === video?.category) + Number(second.creator === video?.creator)
      return secondRelated - firstRelated
      })
    if (recommendationFilter === 'Related') {
      return available.filter((candidate) => candidate.category === video?.category)
    }
    if (recommendationFilter === 'From channel') {
      return available.filter((candidate) => candidate.creator === video?.creator)
    }
    if (recommendationFilter === video?.category) {
      return available.filter((candidate) => candidate.category === video.category)
    }
    return available
  }, [recommendationFilter, video?.category, video?.creator, videoId, videos])

  function goBack() {
    if (location.key === 'default') navigate('/')
    else navigate(-1)
  }

  async function shareVideo() {
    const url = new URL(`/watch/${encodeURIComponent(videoId)}`, window.location.origin).toString()
    try {
      if (navigator.share) {
        await navigator.share({ title: video?.title, url })
        setActionMessage('Video shared.')
      } else {
        await navigator.clipboard.writeText(url)
        setActionMessage('Video link copied.')
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? `Could not share this video: ${error.message}` : 'Could not share this video.')
    }
  }

  async function downloadVideo() {
    if (!video) return
    try {
      const response = await fetch(video.source)
      if (!response.ok) throw new Error(`The video server responded with ${response.status}.`)
      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = safeFileName(video.title)
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      setActionMessage('Download started.')
    } catch (error) {
      setActionMessage(error instanceof Error ? `Could not download this video: ${error.message}` : 'Could not download this video.')
    }
  }

  if (!video) {
    return (
      <section className="watch-page">
        <div className="watch-player">
          <button aria-label="Go back" className="watch-back-button" onClick={goBack} type="button">
            <Icon name="back" size={21} />
          </button>
        </div>
        <p className="watch-not-found">This video is unavailable.</p>
      </section>
    )
  }

  return (
    <div className="watch-page">
      <div className="watch-player">
        <button aria-label="Go back" className="watch-back-button" onClick={goBack} type="button">
          <Icon name="back" size={21} />
        </button>
        {video.contentType === 'image' ? (
          <img alt={video.title} src={video.source} />
        ) : (
          <LongVideoPlayer
            key={video.id}
            poster={videoPoster(video)}
            source={video.source}
            title={video.title}
          />
        )}
      </div>

      <div className="watch-content">
        <section aria-labelledby="watch-title" className="watch-video-details">
          <h1 id="watch-title">{video.title}</h1>
          <p className="watch-video-meta">
            {formatViews(video.views)} <span aria-hidden="true">·</span> {formatVideoAge(video.createdAt)}
          </p>
          {video.description && video.description !== video.title && (
            <p className="watch-description">{video.description}</p>
          )}
        </section>

        <section aria-label="Channel" className="watch-channel">
          <span aria-hidden="true" className="watch-channel-avatar">{video.creator.slice(0, 1).toUpperCase()}</span>
          <div className="watch-channel-copy">
            <strong>{video.creator}</strong>
            <span>@{video.handle} · {formatSubscribers(video.subscriberCount)} subscribers</span>
          </div>
          <button
            aria-pressed={isSubscribed}
            className={`watch-subscribe-button${isSubscribed ? ' is-subscribed' : ''}`}
            onClick={() => setIsSubscribed((current) => !current)}
            type="button"
          >
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        </section>

        <section aria-label="Video actions" className="watch-actions">
          <div className="watch-reaction-group">
            <button
              aria-label={reaction === 'like' ? 'Remove like' : 'Like video'}
              aria-pressed={reaction === 'like'}
              className={reaction === 'like' ? 'is-active' : ''}
              onClick={() => setReaction((current) => current === 'like' ? null : 'like')}
              type="button"
            >
              <Icon name="thumbUp" size={19} />
              <span>Like</span>
            </button>
            <span aria-hidden="true" className="watch-action-divider" />
            <button
              aria-label={reaction === 'dislike' ? 'Remove dislike' : 'Dislike video'}
              aria-pressed={reaction === 'dislike'}
              className={reaction === 'dislike' ? 'is-active' : ''}
              onClick={() => setReaction((current) => current === 'dislike' ? null : 'dislike')}
              type="button"
            >
              <Icon name="thumbDown" size={19} />
              <span>Dislike</span>
            </button>
          </div>
          <button onClick={() => void shareVideo()} type="button">
            <Icon name="share" size={19} />
            <span>Share</span>
          </button>
          <button onClick={() => setActionMessage('Remix tools are coming soon.')} type="button">
            <Icon name="sparkles" size={19} />
            <span>Remix</span>
          </button>
          <button
            aria-pressed={isSaved}
            className={isSaved ? 'is-active' : ''}
            onClick={() => setIsSaved((current) => !current)}
            type="button"
          >
            <Icon name="bookmark" size={19} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
          <button onClick={() => void downloadVideo()} type="button">
            <Icon name="download" size={19} />
            <span>Download</span>
          </button>
        </section>
        {actionMessage && <p className="watch-action-message" role="status">{actionMessage}</p>}

        <section className="watch-comments">
          <button
            aria-expanded={commentsExpanded}
            className="watch-comments-toggle"
            onClick={() => setCommentsExpanded((current) => !current)}
            type="button"
          >
            <span aria-hidden="true" className="watch-comment-avatar">{video.creator.slice(0, 1).toUpperCase()}</span>
            <span className="watch-comments-preview">
              <strong>Comments</strong>
              <span>Be the first to join the conversation</span>
            </span>
            <Icon name="chevron" size={19} />
          </button>
          {commentsExpanded && (
            <p className="watch-comments-empty">Comments for this video aren’t available yet.</p>
          )}
        </section>

        <section aria-labelledby="watch-up-next" className="watch-recommendations">
          <h2 id="watch-up-next">Up next</h2>
          <div aria-label="Filter recommendations" className="watch-category-chips">
            {['All', 'Related', 'From channel', ...(video.category ? [video.category] : [])].map((filter) => (
              <button
                aria-pressed={recommendationFilter === filter}
                className={recommendationFilter === filter ? 'is-active' : ''}
                key={filter}
                onClick={() => setRecommendationFilter(filter)}
                type="button"
              >
                {filter === 'From channel' ? `From ${video.creator}` : filter}
              </button>
            ))}
          </div>
          {recommendations.map((recommendation) => (
            <Link
              className="watch-recommendation"
              key={recommendation.id}
              to={`/watch/${encodeURIComponent(recommendation.id)}`}
            >
              <span className="watch-recommendation-image">
                {recommendation.contentType === 'image' ? (
                  <img alt="" loading="lazy" src={recommendation.source} />
                ) : videoPoster(recommendation) ? (
                  <img alt="" loading="lazy" src={videoPoster(recommendation)} />
                ) : (
                  <span className="watch-recommendation-placeholder"><Icon name="play" size={20} /></span>
                )}
                {recommendation.duration && <span className="watch-recommendation-duration">{recommendation.duration}</span>}
              </span>
              <span className="watch-recommendation-copy">
                <strong>{recommendation.title}</strong>
                <span>{recommendation.creator}</span>
                <span>{formatViews(recommendation.views)} · {formatVideoAge(recommendation.createdAt)}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
