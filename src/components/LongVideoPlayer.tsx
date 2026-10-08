import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

type LongVideoPlayerProps = {
  source: string
  poster?: string
  title: string
}

export default function LongVideoPlayer({ source, poster, title }: LongVideoPlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLVideoElement | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [hasPlaybackError, setHasPlaybackError] = useState(false)
  const [needsManualPlayback, setNeedsManualPlayback] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    setIsMuted(true)
    setHasPlaybackError(false)
    setNeedsManualPlayback(false)

    const player = document.createElement('video')
    playerRef.current = player
    player.src = source
    player.controls = true
    player.autoplay = true
    player.muted = true
    player.preload = 'auto'
    player.playsInline = true
    player.setAttribute('aria-label', title)
    if (poster) player.poster = poster
    player.style.width = '100%'
    player.style.height = '100%'
    player.addEventListener('error', () => setHasPlaybackError(true), { once: true })
    player.addEventListener('volumechange', () => setIsMuted(player.muted))
    mount.replaceChildren(player)
    void player.play().catch(() => setNeedsManualPlayback(true))

    return () => {
      player.pause()
      player.remove()
      if (playerRef.current === player) playerRef.current = null
    }
  }, [poster, source, title])

  const toggleMuted = () => {
    const player = playerRef.current
    if (!player) return

    player.muted = !player.muted
    setIsMuted(player.muted)
    setNeedsManualPlayback(false)
    if (!player.muted) {
      void player.play().catch(() => {
        player.muted = true
        setIsMuted(true)
        setNeedsManualPlayback(true)
      })
    }
  }

  return (
    <>
      <div className="long-video-stage">
        <div aria-label={`Player for ${title}`} className="long-video-player" ref={mountRef} />
        <button
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          aria-pressed={!isMuted}
          className="long-video-mute-button"
          onClick={toggleMuted}
          type="button"
        >
          <Icon name={isMuted ? 'volumeOff' : 'volumeOn'} size={21} />
        </button>
      </div>
      {hasPlaybackError && (
        <p className="long-video-error" role="alert">
          This video could not be played. Check your connection and try again.
        </p>
      )}
      {needsManualPlayback && !hasPlaybackError && (
        <p className="long-video-error" role="status">Tap play to start this video.</p>
      )}
    </>
  )
}
