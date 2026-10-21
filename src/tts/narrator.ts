/**
 * Speaks Vietnamese lines with the browser's built-in speech engine and provides
 * pause-aware waiting, so the whole game can be paused from one button.
 */

export interface VoiceOption {
  uri: string
  label: string
}

type Listener = () => void

class PauseGate {
  paused = false
  private waiters: Listener[] = []
  private listeners = new Set<Listener>()

  set(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) synth?.cancel()
    else this.waiters.splice(0).forEach((w) => w())
    this.listeners.forEach((l) => l())
  }

  whenResumed(): Promise<void> {
    return this.paused ? new Promise((r) => this.waiters.push(r)) : Promise.resolve()
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }
}

export const pauseGate = new PauseGate()

const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined

export const speechSupported = !!synth

export function vietnameseVoices(): SpeechSynthesisVoice[] {
  return (synth?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('vi'))
}

/** Voices load asynchronously on most browsers; calls back whenever the list changes. */
export function onVoicesChanged(cb: Listener): () => void {
  if (!synth) return () => {}
  synth.addEventListener('voiceschanged', cb)
  return () => synth.removeEventListener('voiceschanged', cb)
}

interface VoiceConfig {
  voiceURI: string | null
  rate: number
  volume: number
}

let config: VoiceConfig = { voiceURI: null, rate: 1, volume: 1 }

export function configureVoice(next: VoiceConfig) {
  config = next
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = vietnameseVoices()
  return voices.find((v) => v.voiceURI === config.voiceURI) ?? voices.find((v) => v.localService) ?? voices[0]
}

export class Aborted extends Error {
  constructor() {
    super('aborted')
  }
}

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw new Aborted()
}

/** Waits `ms` of un-paused time. */
export async function wait(ms: number, signal: AbortSignal): Promise<void> {
  let left = ms
  while (left > 0) {
    await pauseGate.whenResumed()
    throwIfAborted(signal)
    const step = Math.min(left, 200)
    const started = Date.now()
    await new Promise((r) => setTimeout(r, step))
    throwIfAborted(signal)
    if (!pauseGate.paused) left -= Date.now() - started
  }
}

/** Some engines (notably Safari) occasionally never fire `end`; never wait longer than this. */
const estimateMs = (text: string) => 2500 + (text.length * 110) / config.rate

function speakOnce(text: string, signal: AbortSignal): Promise<'done' | 'interrupted'> {
  return new Promise((resolve) => {
    if (!synth) {
      setTimeout(() => resolve('done'), estimateMs(text) * 0.6)
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'vi-VN'
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.rate = config.rate
    u.volume = config.volume
    let settled = false
    const finish = (r: 'done' | 'interrupted') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(r)
    }
    const onAbort = () => {
      synth.cancel()
      finish('interrupted')
    }
    const timer = setTimeout(() => finish('done'), estimateMs(text))
    u.onend = () => finish(pauseGate.paused ? 'interrupted' : 'done')
    u.onerror = () => finish(pauseGate.paused || signal.aborted ? 'interrupted' : 'done')
    signal.addEventListener('abort', onAbort)
    synth.speak(u)
  })
}

/** Speaks one line; if the game is paused mid-sentence the line is repeated after resuming. */
export async function speak(text: string, signal: AbortSignal): Promise<void> {
  for (;;) {
    await pauseGate.whenResumed()
    throwIfAborted(signal)
    const result = await speakOnce(text, signal)
    throwIfAborted(signal)
    if (result === 'done' && !pauseGate.paused) return
  }
}

export async function speakAll(lines: string[], signal: AbortSignal, onLine?: (line: string) => void) {
  for (const line of lines) {
    onLine?.(line)
    await speak(line, signal)
    await wait(350, signal)
  }
}

export function stopSpeaking() {
  synth?.cancel()
}

let audio: AudioContext | undefined

/** iOS only allows speech and sound after a tap; call this from a click handler. */
export function unlockAudio() {
  if (synth) {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
  }
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    // No Web Audio: timers just end silently.
  }
}

export function beep(times = 1) {
  if (!audio) return
  for (let i = 0; i < times; i++) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const t = audio.currentTime + i * 0.35
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.4 * config.volume + 0.0001, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  }
}
