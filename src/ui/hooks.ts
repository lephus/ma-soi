import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { timerWarning, type Line } from '../game/script'
import { Aborted, pauseGate, speakAll, wait } from '../tts/narrator'

export function usePaused(): boolean {
  return useSyncExternalStore(
    (l) => pauseGate.subscribe(l),
    () => pauseGate.paused,
  )
}

export interface RunContext {
  signal: AbortSignal
  say: (lines: Line[]) => Promise<void>
  wait: (seconds: number) => Promise<void>
}

/**
 * Runs a phase's narration script once when the component mounts and aborts it on unmount.
 * Returns the line being spoken so it can be shown as a caption.
 */
export function useScript(run: (ctx: RunContext) => Promise<void>): string {
  const [caption, setCaption] = useState('')
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const ctx: RunContext = {
      signal,
      say: (lines) => speakAll(lines, signal, setCaption),
      wait: (seconds) => wait(seconds * 1000, signal),
    }
    runRef.current(ctx).catch((e) => {
      if (!(e instanceof Aborted)) console.error(e)
    })
    return () => controller.abort()
  }, [])

  return caption
}

export interface Countdown {
  remaining: number
  running: boolean
  start: () => void
  addSeconds: (n: number) => void
  finish: () => void
}

/**
 * A pause-aware countdown. Calls `onWarning` with spoken reminders and `onDone` once,
 * either when time runs out or when `finish` is called.
 */
export function useCountdown(seconds: number, onDone: () => void, onWarning?: (text: string) => void): Countdown {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const paused = usePaused()
  const state = useRef({ left: seconds * 1000, total: seconds, done: false, lastWhole: seconds })
  const cb = useRef({ onDone, onWarning })
  cb.current = { onDone, onWarning }

  const finish = () => {
    if (state.current.done) return
    state.current.done = true
    setRunning(false)
    setRemaining(0)
    cb.current.onDone()
  }

  useEffect(() => {
    if (!running || paused) return
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      state.current.left -= now - last
      last = now
      const whole = Math.max(0, Math.ceil(state.current.left / 1000))
      if (whole !== state.current.lastWhole) {
        state.current.lastWhole = whole
        setRemaining(whole)
        const warning = timerWarning(whole, state.current.total)
        if (warning) cb.current.onWarning?.(warning)
      }
      if (state.current.left <= 0) finish()
    }, 200)
    return () => clearInterval(id)
  }, [running, paused])

  return {
    remaining,
    running,
    start: () => setRunning(true),
    addSeconds: (n) => {
      state.current.left += n * 1000
      state.current.total += n
      state.current.lastWhole = Math.ceil(state.current.left / 1000)
      setRemaining(state.current.lastWhole)
    },
    finish,
  }
}

/** Keeps the phone screen on while the game runs; a sleeping phone stops speech and timers. */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        // Not supported or denied (e.g. low battery mode).
      }
    }
    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [])
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
