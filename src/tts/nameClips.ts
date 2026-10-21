/**
 * Player names can't be recorded ahead of time, so they are fetched from /api/tts (Edge TTS)
 * when a game starts and kept in Cache Storage. Returns null when that isn't possible
 * (offline, or hosted without the API), and the narrator falls back to the device voice.
 */

const CACHE = 'ma-soi-names'
const loaded = new Map<string, Promise<string | null>>()

const apiUrl = (voice: string, text: string) =>
  `${import.meta.env.BASE_URL}api/tts?voice=${voice}&text=${encodeURIComponent(text)}`

/** An object URL with `text` read in `voice`, or null. */
export function nameClip(voice: string, text: string): Promise<string | null> {
  const url = apiUrl(voice, text)
  let clip = loaded.get(url)
  if (!clip) {
    clip = load(url)
    loaded.set(url, clip)
    // Try again next time, e.g. once back online.
    void clip.then((u) => u || loaded.delete(url))
  }
  return clip
}

async function load(url: string): Promise<string | null> {
  try {
    // Cache Storage only exists on HTTPS and localhost.
    const cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE).catch(() => undefined)
    let res = await cache?.match(url)
    if (!res) {
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      // A static host answers unknown paths with index.html.
      if (!res.ok || !res.headers.get('content-type')?.startsWith('audio/')) return null
      await cache?.put(url, res.clone()).catch(() => {})
    }
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}
