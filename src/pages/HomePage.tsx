import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import {
  formatVideoAge,
  formatViews,
  loadLongVideos,
  sampleVideos,
  videoPoster,
  type LongVideo,
} from '../lib/longVideos'

const shorts = [
  { id: 'chai-break', creator: 'Nisha Cooks', caption: 'बस 5 मिनट में मसाला चाय ☕', image: 'photo-1571934811356-5cc061b6821f' },
  { id: 'city-lights', creator: 'Frames by Dev', caption: 'रात का शहर कुछ अलग ही है ✨', image: 'photo-1519608487953-e999c86e7455' },
  { id: 'little-joys', creator: 'Mira Makes Music', caption: 'छोटी खुशियाँ ही तो ज़िंदगी हैं 💛', image: 'photo-1500530855697-b586d89ba3ee' },
  { id: 'mountain-air', creator: 'Aarav on the Move', caption: 'पहाड़ बुला रहे हैं 🏔️', image: 'photo-1470770841072-f978cf4d019e' },
]

const topics = ['For you', 'Music', 'Travel', 'Food', 'Gaming', 'Design', 'Other']

export default function HomePage() {
  const [activeTopic, setActiveTopic] = useState('For you')
  const [hiddenVideos, setHiddenVideos] = useState<string[]>([])
  const [savedVideos, setSavedVideos] = useState<string[]>([])
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [longVideos, setLongVideos] = useState<LongVideo[]>([])
  const filteredLongVideos = useMemo(() => longVideos.filter((video) =>
    !hiddenVideos.includes(video.id) && (activeTopic === 'For you' || video.category === activeTopic),
  ), [activeTopic, hiddenVideos, longVideos])
  const filteredSampleVideos = sampleVideos.filter((video) =>
    !hiddenVideos.includes(video.id) && (activeTopic === 'For you' || video.category === activeTopic),
  )

  useEffect(() => {
    let active = true
    let releaseLoadedVideos = () => {}
    void loadLongVideos().then((result) => {
      if (!active) {
        result.release()
        return
      }
      releaseLoadedVideos = result.release
      setLongVideos(result.videos)
    })

    return () => {
      active = false
      releaseLoadedVideos()
    }
  }, [])

  const feedVideos = [...filteredLongVideos, ...filteredSampleVideos]

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
              <Link
                aria-label={`Watch ${video.title}`}
                className="video-thumbnail long-video-poster-button"
                to={`/watch/${encodeURIComponent(video.id)}`}
              >
                {video.contentType === 'image' ? (
                  <img
                    alt=""
                    className="video-image-preview"
                    loading={index > 1 ? 'lazy' : 'eager'}
                    src={video.source}
                  />
                ) : videoPoster(video) && (
                  <img
                    alt=""
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    loading={index > 1 ? 'lazy' : 'eager'}
                    src={videoPoster(video)}
                  />
                )}
                <span className="long-video-play"><Icon name="play" size={23} /></span>
                {video.duration && <span className="video-duration">{video.duration}</span>}
              </Link>
              <div className="video-information">
                <Link
                  aria-label={`Watch ${video.title}`}
                  className="video-information-link"
                  to={`/watch/${encodeURIComponent(video.id)}`}
                >
                  <span aria-hidden="true" className="video-avatar long-video-avatar">{video.creator.slice(0, 1).toUpperCase()}</span>
                  <div className="video-copy">
                    <h2>{video.title}</h2>
                    <p>{video.creator} <span aria-hidden="true">·</span> @{video.handle}</p>
                    <p>{formatViews(video.views)}<span aria-hidden="true"> · </span>{formatVideoAge(video.createdAt)}</p>
                    {video.description && video.description !== video.title && <p className="long-video-description">{video.description}</p>}
                  </div>
                </Link>
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
