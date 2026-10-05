import { useEffect, useRef, useState } from 'react'

type LongVideoPlayerProps = {
  source: string
  poster?: string
  title: string
}

export default function LongVideoPlayer({ source, poster, title }: LongVideoPlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [hasPlaybackError, setHasPlaybackError] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const player = document.createElement('genmb-video')
    player.setAttribute('src', source)
    player.setAttribute('controls', '')
    player.setAttribute('preload', 'metadata')
    player.setAttribute('playsinline', '')
    player.setAttribute('aria-label', title)
    if (poster) player.setAttribute('poster', poster)
    player.style.width = '100%'
    player.style.height = '100%'
    const handlePlaybackError = () => setHasPlaybackError(true)
    player.addEventListener('genmb-video-error', handlePlaybackError)
    mount.replaceChildren(player)

    return () => {
      player.removeEventListener('genmb-video-error', handlePlaybackError)
      player.remove()
    }
  }, [poster, source, title])

  return (
    <>
      <div aria-label={`Player for ${title}`} className="long-video-player" ref={mountRef} />
      {hasPlaybackError && (
        <p className="long-video-error" role="alert">
          This video could not be played. Check your connection and try again.
        </p>
      )}
    </>
  )
}
