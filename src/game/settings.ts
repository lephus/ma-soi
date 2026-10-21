import type { NarratorVoice } from '../tts/narrator'

export interface Settings {
  /** Seconds everyone has to close their eyes before the first role is called. */
  nightIntroSeconds: number
  /** A role that is dead or out of potions is still called; the app waits a random time in this range. */
  fakeWakeMinSeconds: number
  fakeWakeMaxSeconds: number
  /** Pause after a role confirms, so the phone can be put down before the next call. */
  afterActionSeconds: number
  discussionSeconds: number
  voteSeconds: number
  /** 0 skips the last-words step. */
  lastWordsSeconds: number
  /** Announce the role of everyone who dies. */
  revealRoleOnDeath: boolean
  voice: NarratorVoice
  /** Browser voice used for player names, and for everything when `voice` is "device". */
  voiceURI: string | null
  speechRate: number
  volume: number
}

export const DEFAULT_SETTINGS: Settings = {
  nightIntroSeconds: 5,
  fakeWakeMinSeconds: 8,
  fakeWakeMaxSeconds: 15,
  afterActionSeconds: 3,
  discussionSeconds: 180,
  voteSeconds: 30,
  lastWordsSeconds: 30,
  revealRoleOnDeath: false,
  voice: 'HoaiMy',
  voiceURI: null,
  speechRate: 1,
  volume: 1,
}

const KEY = 'ma-soi:settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Private mode or storage full: settings just won't persist.
  }
}
