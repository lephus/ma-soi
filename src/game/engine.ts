import { NIGHT_ORDER, ROLES, buildDeck, type NightRole, type RoleCounts, type RoleId, type Team } from './roles'

export interface Player {
  id: string
  name: string
  role: RoleId
  alive: boolean
}

export type DeathCause = 'WOLF' | 'POISON'

export interface Death {
  playerId: string
  cause: DeathCause
}

export type Phase =
  | { t: 'NIGHT_START' }
  | { t: 'NIGHT_ROLE'; role: NightRole }
  | { t: 'DAWN'; deaths: Death[] }
  | { t: 'HUNTER'; hunterId: string; next: 'DISCUSSION' | 'NIGHT'; shot?: string | null }
  | { t: 'DISCUSSION' }
  | { t: 'VOTE' }
  | { t: 'LAST_WORDS'; targetId: string }
  | { t: 'EXECUTION'; targetId: string | null }
  | { t: 'ENDED'; winner: Team }

export interface NightActions {
  seerTarget?: string | null
  guardTarget?: string | null
  wolfTarget?: string | null
  witchHeal?: boolean
  witchPoison?: string | null
}

export interface LogEntry {
  day: number
  text: string
}

export interface GameState {
  version: 1
  players: Player[]
  /** Roles dealt this game; night calls are based on this, not on who is still alive. */
  deck: RoleId[]
  day: number
  /** Increments on every transition so the UI can restart a phase's narration. */
  step: number
  phase: Phase
  night: NightActions
  lastGuarded: string | null
  witchHealUsed: boolean
  witchPoisonUsed: boolean
  log: LogEntry[]
}

export type NightAction =
  | { role: 'SEER'; target: string | null }
  | { role: 'GUARD'; target: string | null }
  | { role: 'WEREWOLF'; target: string | null }
  | { role: 'WITCH'; heal: boolean; poison: string | null }

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function createGame(names: string[], counts: RoleCounts, random = Math.random): GameState {
  const deck = buildDeck(counts, names.length)
  const dealt = shuffle(deck, random)
  return {
    version: 1,
    players: names.map((name, i) => ({ id: `p${i}`, name, role: dealt[i], alive: true })),
    deck,
    day: 1,
    step: 0,
    phase: { t: 'NIGHT_START' },
    night: {},
    lastGuarded: null,
    witchHealUsed: false,
    witchPoisonUsed: false,
    log: [{ day: 1, text: 'Trò chơi bắt đầu' }],
  }
}

export const playerById = (s: GameState, id: string | null | undefined) =>
  id ? s.players.find((p) => p.id === id) : undefined

export const alivePlayers = (s: GameState) => s.players.filter((p) => p.alive)

const aliveWithRole = (s: GameState, role: RoleId) => s.players.filter((p) => p.alive && p.role === role)

export function nameOf(s: GameState, id: string | null | undefined): string {
  return playerById(s, id)?.name ?? 'Không rõ'
}

/** Night roles that are called this game, in calling order. */
export function nightRolesInDeck(s: GameState): NightRole[] {
  return NIGHT_ORDER.filter((r) => s.deck.includes(r))
}

/**
 * Whether someone actually has to act when this role is called. When false the role
 * is still called and the app waits on its own, so nobody can tell who is dead.
 */
export function isRealWake(s: GameState, role: NightRole): boolean {
  if (aliveWithRole(s, role).length === 0) return false
  if (role === 'WITCH') return !s.witchHealUsed || !s.witchPoisonUsed
  return true
}

/** Players a night role may pick. */
export function nightTargets(s: GameState, role: NightRole): Player[] {
  const alive = alivePlayers(s)
  switch (role) {
    case 'SEER':
      return alive.filter((p) => p.role !== 'SEER')
    case 'GUARD':
      return alive.filter((p) => p.id !== s.lastGuarded)
    case 'WEREWOLF':
      return alive.filter((p) => p.role !== 'WEREWOLF')
    case 'WITCH':
      return alive.filter((p) => p.role !== 'WITCH')
  }
}

export function hunterTargets(s: GameState): Player[] {
  return alivePlayers(s)
}

export function winner(s: GameState): Team | null {
  const alive = alivePlayers(s)
  const wolves = alive.filter((p) => ROLES[p.role].team === 'WOLF').length
  if (wolves === 0) return 'VILLAGE'
  if (wolves >= alive.length - wolves) return 'WOLF'
  return null
}

const withLog = (s: GameState, text: string): GameState => ({ ...s, log: [...s.log, { day: s.day, text }] })

const goto = (s: GameState, phase: Phase): GameState => ({ ...s, phase, step: s.step + 1 })

function kill(s: GameState, ids: string[]): GameState {
  return { ...s, players: s.players.map((p) => (ids.includes(p.id) ? { ...p, alive: false } : p)) }
}

export function act(s: GameState, action: NightAction): GameState {
  if (s.phase.t !== 'NIGHT_ROLE' || s.phase.role !== action.role) {
    throw new Error(`Không thể thực hiện hành động ${action.role} lúc này`)
  }
  switch (action.role) {
    case 'SEER': {
      const target = playerById(s, action.target)
      const text = target
        ? `Tiên tri soi ${target.name}: ${target.role === 'WEREWOLF' ? 'là Sói' : 'không phải Sói'}`
        : 'Tiên tri không soi ai'
      return withLog({ ...s, night: { ...s.night, seerTarget: action.target } }, text)
    }
    case 'GUARD':
      return withLog(
        { ...s, night: { ...s.night, guardTarget: action.target } },
        action.target ? `Bảo vệ che chắn cho ${nameOf(s, action.target)}` : 'Bảo vệ không che chắn ai',
      )
    case 'WEREWOLF':
      return withLog(
        { ...s, night: { ...s.night, wolfTarget: action.target } },
        action.target ? `Ma Sói cắn ${nameOf(s, action.target)}` : 'Ma Sói không cắn ai',
      )
    case 'WITCH': {
      const heal = action.heal && !s.witchHealUsed && !!s.night.wolfTarget
      const poison = s.witchPoisonUsed ? null : action.poison
      let next: GameState = { ...s, night: { ...s.night, witchHeal: heal, witchPoison: poison } }
      if (heal) next = withLog(next, `Phù thủy cứu ${nameOf(s, s.night.wolfTarget)}`)
      if (poison) next = withLog(next, `Phù thủy đầu độc ${nameOf(s, poison)}`)
      if (!heal && !poison) next = withLog(next, 'Phù thủy không dùng bình nào')
      return next
    }
  }
}

export function resolveNight(s: GameState): Death[] {
  const { wolfTarget, guardTarget, witchHeal, witchPoison } = s.night
  const deaths: Death[] = []
  if (wolfTarget && wolfTarget !== guardTarget && !witchHeal) deaths.push({ playerId: wolfTarget, cause: 'WOLF' })
  if (witchPoison && !deaths.some((d) => d.playerId === witchPoison)) {
    deaths.push({ playerId: witchPoison, cause: 'POISON' })
  }
  return deaths
}

function deadHunter(s: GameState, deaths: string[]): Player | undefined {
  return s.players.find((p) => p.role === 'HUNTER' && deaths.includes(p.id))
}

function endOr(s: GameState, otherwise: Phase): GameState {
  const team = winner(s)
  if (!team) return goto(s, otherwise)
  return goto(withLog(s, team === 'WOLF' ? 'Phe Ma Sói chiến thắng' : 'Phe Dân Làng chiến thắng'), { t: 'ENDED', winner: team })
}

/** End of a day: either someone has won or the next night falls. */
function endOrNight(s: GameState): GameState {
  if (winner(s)) return endOr(s, { t: 'NIGHT_START' })
  const day = s.day + 1
  return goto({ ...s, day, night: {}, log: [...s.log, { day, text: `Đêm thứ ${day}` }] }, { t: 'NIGHT_START' })
}

/** Moves to the next phase. VOTE and HUNTER need their action first (`vote`, `hunterShoot`). */
export function advance(s: GameState): GameState {
  const phase = s.phase
  switch (phase.t) {
    case 'NIGHT_START': {
      const [first] = nightRolesInDeck(s)
      return goto(s, { t: 'NIGHT_ROLE', role: first })
    }
    case 'NIGHT_ROLE': {
      const order = nightRolesInDeck(s)
      const next = order[order.indexOf(phase.role) + 1]
      if (next) return goto(s, { t: 'NIGHT_ROLE', role: next })
      const deaths = resolveNight(s)
      let after = kill(s, deaths.map((d) => d.playerId))
      after = {
        ...after,
        lastGuarded: s.night.guardTarget ?? null,
        witchHealUsed: s.witchHealUsed || !!s.night.witchHeal,
        witchPoisonUsed: s.witchPoisonUsed || !!s.night.witchPoison,
      }
      after = withLog(
        after,
        deaths.length ? `Sáng ngày ${s.day}: ${deaths.map((d) => nameOf(s, d.playerId)).join(', ')} chết` : `Sáng ngày ${s.day}: không ai chết`,
      )
      return goto(after, { t: 'DAWN', deaths })
    }
    case 'DAWN': {
      const hunter = deadHunter(s, phase.deaths.map((d) => d.playerId))
      if (hunter) return goto(s, { t: 'HUNTER', hunterId: hunter.id, next: 'DISCUSSION' })
      return endOr(s, { t: 'DISCUSSION' })
    }
    case 'HUNTER':
      if (phase.shot === undefined) throw new Error('Thợ săn chưa chọn')
      if (phase.next === 'DISCUSSION') return endOr(s, { t: 'DISCUSSION' })
      return endOrNight(s)
    case 'DISCUSSION':
      return goto(s, { t: 'VOTE' })
    case 'VOTE':
      throw new Error('Cần chọn kết quả bỏ phiếu')
    case 'LAST_WORDS': {
      const target = playerById(s, phase.targetId)
      const hanged = withLog(kill(s, [phase.targetId]), `Ngày ${s.day}: ${target?.name} bị treo cổ`)
      return goto(hanged, { t: 'EXECUTION', targetId: phase.targetId })
    }
    case 'EXECUTION': {
      if (phase.targetId) {
        const hunter = deadHunter(s, [phase.targetId])
        if (hunter) return goto(s, { t: 'HUNTER', hunterId: hunter.id, next: 'NIGHT' })
      }
      return endOrNight(s)
    }
    case 'ENDED':
      return s
  }
}

/** Records the village's decision. `targetId` null means nobody is hanged. */
export function vote(s: GameState, targetId: string | null): GameState {
  if (s.phase.t !== 'VOTE') throw new Error('Không phải lúc bỏ phiếu')
  if (!targetId) return goto(withLog(s, `Ngày ${s.day}: không ai bị treo cổ`), { t: 'EXECUTION', targetId: null })
  return goto(s, { t: 'LAST_WORDS', targetId })
}

export function hunterShoot(s: GameState, targetId: string | null): GameState {
  if (s.phase.t !== 'HUNTER') throw new Error('Không phải lượt Thợ săn')
  const phase = { ...s.phase, shot: targetId }
  if (!targetId) return withLog({ ...s, phase }, 'Thợ săn không bắn ai')
  return withLog(kill({ ...s, phase }, [targetId]), `Thợ săn bắn ${nameOf(s, targetId)}`)
}

/** Manual correction from the menu. */
export function setAlive(s: GameState, id: string, alive: boolean): GameState {
  const players = s.players.map((p) => (p.id === id ? { ...p, alive } : p))
  return withLog({ ...s, players }, `${nameOf(s, id)} được ${alive ? 'hồi sinh' : 'đánh dấu chết'} bằng tay`)
}
