import { useEffect, useReducer } from 'react'
import { GAME_VERSION, type GameState } from './engine'

/** 'deal' while players pass the phone to see their cards, 'play' once the first night starts. */
export type Stage = 'deal' | 'play'

export interface Store {
  game: GameState | null
  stage: Stage
  /** The game as it was when the current phase began; undo returns here or further back. */
  phaseStart: GameState | null
  history: GameState[]
  /** Bumped on undo so the current phase restarts its narration even if its step number is unchanged. */
  epoch: number
}

type Action =
  | { type: 'new'; game: GameState }
  | { type: 'play' }
  | { type: 'apply'; fn: (s: GameState) => GameState }
  | { type: 'undo' }
  | { type: 'clear' }

const HISTORY_LIMIT = 40
const KEY = 'ma-soi:game'

const empty: Store = { game: null, stage: 'deal', phaseStart: null, history: [], epoch: 0 }

function reducer(store: Store, action: Action): Store {
  switch (action.type) {
    case 'new':
      return { ...empty, game: action.game, phaseStart: action.game, epoch: store.epoch + 1 }
    case 'play':
      return { ...store, stage: 'play' }
    case 'apply': {
      if (!store.game) return store
      const next = action.fn(store.game)
      if (next.step === store.game.step) return { ...store, game: next }
      const history = store.phaseStart ? [...store.history, store.phaseStart].slice(-HISTORY_LIMIT) : store.history
      return { ...store, game: next, phaseStart: next, history }
    }
    case 'undo': {
      const previous = store.history[store.history.length - 1]
      // With no earlier phase, undo restarts the current one.
      const target = previous ?? store.phaseStart
      if (!target) return store
      return {
        ...store,
        game: target,
        phaseStart: target,
        history: previous ? store.history.slice(0, -1) : store.history,
        epoch: store.epoch + 1,
      }
    }
    case 'clear':
      return { ...empty, epoch: store.epoch + 1 }
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const saved = JSON.parse(raw) as Store
    if (saved.game?.version !== GAME_VERSION) return empty
    return { ...empty, ...saved }
  } catch {
    return empty
  }
}

export function useGameStore() {
  const [store, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      if (store.game) localStorage.setItem(KEY, JSON.stringify(store))
      else localStorage.removeItem(KEY)
    } catch {
      // Storage unavailable: the game still works, it just can't be resumed after a reload.
    }
  }, [store])

  return [store, dispatch] as const
}

const NAMES_KEY = 'ma-soi:names'

export function loadNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveNames(names: string[]) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names))
  } catch {
    // Not critical.
  }
}
