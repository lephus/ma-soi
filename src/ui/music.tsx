import { useSyncExternalStore } from 'react'

/** "Nhạc nền Ma Sói online" on YouTube, looped through an embedded player. */
const VIDEO_ID = 'nXfdGLMDvXQ'
/** Low enough that the narrator stays clear over the music. */
const VOLUME = 30

let on = false
const listeners = new Set<() => void>()

const toggle = () => {
  on = !on
  listeners.forEach((l) => l())
}

const useMusicOn = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => on,
  )

export function MusicButton({ className = '' }: { className?: string }) {
  const playing = useMusicOn()
  return (
    <button
      onClick={toggle}
      className={`rounded-full bg-panel px-4 py-2 ${className}`}
      aria-label={playing ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
      aria-pressed={playing}
    >
      {playing ? '🔊' : '🔈'}
    </button>
  )
}

/** Mounted once; the player only exists while music is on, so turning it off stops it completely. */
export function BackgroundMusic() {
  const playing = useMusicOn()
  if (!playing) return null
  const src = `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&loop=1&playlist=${VIDEO_ID}&controls=0&enablejsapi=1`
  return (
    <iframe
      src={src}
      title="Nhạc nền"
      allow="autoplay; encrypted-media"
      className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
      onLoad={(e) => {
        // The player ignores commands until it is ready, so repeat the volume a few times.
        const player = e.currentTarget.contentWindow
        const command = JSON.stringify({ event: 'command', func: 'setVolume', args: [VOLUME] })
        for (const ms of [0, 1000, 3000]) setTimeout(() => player?.postMessage(command, 'https://www.youtube.com'), ms)
      }}
    />
  )
}
