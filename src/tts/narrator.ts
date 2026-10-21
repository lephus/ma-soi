/**
 * Speaks Vietnamese lines and provides pause-aware waiting, so the whole game can be paused
 * from one button. Fixed wording plays clips recorded with Edge TTS (`npm run gen-voice`) and
 * player names are fetched from /api/tts. The browser's speech engine is the fallback, and reads
 * everything when the "device" voice is chosen.
 */

import { lineParts, lineText, phraseKey, type Line } from '../game/script'
import clips from './clips.json'
import { nameClip } from './nameClips'

export type NarratorVoice = 'HoaiMy' | 'NamMinh' | 'device'

export const NARRATOR_VOICES: { id: NarratorVoice; label: string }[] = [
  { id: 'HoaiMy', label: 'Hoài My (nữ)' },
  { id: 'NamMinh', label: 'Nam Minh (nam)' },
  { id: 'device', label: 'Giọng có sẵn trên máy' },
]

const clipFiles: Record<string, string> = clips.files

type Listener = () => void

class PauseGate {
  paused = false
  private waiters: Listener[] = []
  private listeners = new Set<Listener>()

  set(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) stopSpeaking()
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
  voice: NarratorVoice
  /** Browser voice for names, and for everything when `voice` is "device". */
  voiceURI: string | null
  rate: number
  volume: number
}

let config: VoiceConfig = { voice: 'HoaiMy', voiceURI: null, rate: 1, volume: 1 }

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

type Result = 'done' | 'interrupted' | 'failed'

const player: HTMLAudioElement | undefined = typeof Audio !== 'undefined' ? new Audio() : undefined
let interruptClip: (() => void) | undefined
/** Bumped on every play so a stale unlock never pauses a real clip. */
let playToken = 0

const clipUrl = (file: string) => `${import.meta.env.BASE_URL}voice/${config.voice}/${file}.mp3`

/** Starts fetching name clips so they are ready (and cached for offline) before they are needed. */
export function prefetchNames(names: string[]) {
  if (config.voice !== 'device') names.forEach((n) => void nameClip(config.voice, n.trim()))
}

function playClip(url: string, text: string, signal: AbortSignal): Promise<Result> {
  return new Promise((resolve) => {
    if (!player) return resolve('failed')
    playToken++
    let settled = false
    const finish = (r: Result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      player.onended = player.onerror = null
      interruptClip = undefined
      signal.removeEventListener('abort', onAbort)
      resolve(r)
    }
    const onAbort = () => {
      player.pause()
      finish('interrupted')
    }
    const timer = setTimeout(() => finish('done'), estimateMs(text))
    interruptClip = onAbort
    player.onended = () => finish(pauseGate.paused ? 'interrupted' : 'done')
    player.onerror = () => finish('failed')
    signal.addEventListener('abort', onAbort)
    player.muted = false
    player.src = url
    player.defaultPlaybackRate = player.playbackRate = config.rate
    player.volume = config.volume
    player.play().catch(() => finish(pauseGate.paused || signal.aborted ? 'interrupted' : 'failed'))
  })
}

async function speakOnce(line: Line, signal: AbortSignal): Promise<Result> {
  if (config.voice === 'device') return speakText(lineText(line), signal)
  for (const part of lineParts(line)) {
    const key = phraseKey(part)
    if (!key) continue
    const file = clipFiles[key]
    const url = file ? clipUrl(file) : await nameClip(config.voice, key)
    throwIfAborted(signal)
    let result: Result = url ? await playClip(url, key, signal) : 'failed'
    if (result === 'failed') result = await speakText(key, signal)
    if (result === 'interrupted') return result
  }
  return 'done'
}

function speakText(text: string, signal: AbortSignal): Promise<Result> {
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
export async function speak(line: Line, signal: AbortSignal): Promise<void> {
  for (;;) {
    await pauseGate.whenResumed()
    throwIfAborted(signal)
    const result = await speakOnce(line, signal)
    throwIfAborted(signal)
    if (result !== 'interrupted' && !pauseGate.paused) return
  }
}

export async function speakAll(lines: Line[], signal: AbortSignal, onLine?: (text: string) => void) {
  for (const line of lines) {
    onLine?.(lineText(line))
    await speak(line, signal)
    await wait(350, signal)
  }
}

export function stopSpeaking() {
  synth?.cancel()
  interruptClip?.()
}

let audio: AudioContext | undefined

/** A few milliseconds of silence, played on a tap so iOS lets the clip player start later on its own. */
const SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA'

/** iOS only allows speech and sound after a tap; call this from a click handler. */
export function unlockAudio() {
  if (synth) {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
  }
  if (player && !interruptClip) {
    const token = ++playToken
    player.muted = true
    player.src = SILENCE
    player
      .play()
      .then(() => token === playToken && player.pause())
      .catch(() => {})
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
