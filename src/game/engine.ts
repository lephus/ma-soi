import {
  FIRST_NIGHT_ONLY,
  NIGHT_ORDER,
  ROLES,
  STEP_CARD,
  buildDeck,
  type NightRole,
  type NightStep,
  type RoleCounts,
  type RoleId,
  type Winner,
} from './roles'

export interface Player {
  id: string
  name: string
  role: RoleId
  alive: boolean
}

export type DeathCause = 'WOLF' | 'POISON' | 'GRIEF'

export interface Death {
  playerId: string
  cause: DeathCause
}

/** Where the game goes once everything a death triggers (Hunter's shot, a new Village Chief) is done. */
export type Then = 'DISCUSSION' | 'NIGHT'

export type Phase =
  | { t: 'NIGHT_START' }
  | { t: 'NIGHT_ROLE'; role: NightStep }
  | { t: 'DAWN'; deaths: Death[] }
  | { t: 'HUNTER'; hunterId: string; next: Then; shot?: string | null; grief?: string[] }
  | { t: 'SHERIFF_ELECTION'; chosen?: string | null }
  | { t: 'SHERIFF_SUCCESSOR'; formerId: string; next: Then; chosen?: string | null }
  | { t: 'DISCUSSION' }
  | { t: 'VOTE' }
  | { t: 'LAST_WORDS'; targetId: string; tie?: boolean }
  /** `spared`: the Village Idiot was revealed instead of hanged. `grief`: lovers who died along. */
  | { t: 'EXECUTION'; targetId: string | null; spared?: boolean; tie?: boolean; grief?: string[] }
  | { t: 'SCAPEGOAT'; scapegoatId: string; chosen?: string[] }
  | { t: 'ENDED'; winner: Winner }

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

export const GAME_VERSION = 2

export interface GameState {
  version: typeof GAME_VERSION
  players: Player[]
  /** Every card in play, including the Thief's extra cards; night calls are based on this, not on who is alive. */
  deck: RoleId[]
  /** Cards nobody holds: the Thief's two extra cards, after any swap. */
  leftover: RoleId[]
  day: number
  /** Increments on every transition so the UI can restart a phase's narration. */
  step: number
  phase: Phase
  night: NightActions
  lastGuarded: string | null
  witchHealUsed: boolean
  witchPoisonUsed: boolean
  lovers: [string, string] | null
  charmed: string[]
  sheriff: string | null
  /** The village still has to elect a Village Chief, on the first morning. */
  electSheriff: boolean
  /** The Elder already survived one wolf bite. */
  elderHit: boolean
  /** The village killed the Elder: village roles have no powers from then on. */
  villagePowersLost: boolean
  idiotRevealed: boolean
  hunterDone: boolean
  /** Chosen by the Scapegoat: who may vote on the next day. */
  voters: string[] | null
  log: LogEntry[]
}

export type NightAction =
  | { role: 'SEER'; target: string | null }
  | { role: 'GUARD'; target: string | null }
  | { role: 'WEREWOLF'; target: string | null }
  | { role: 'WITCH'; heal: boolean; poison: string | null }
  /** `take`: index into `leftover`, or null to keep the Thief card. */
  | { role: 'THIEF'; take: number | null }
  | { role: 'CUPID'; lovers: [string, string] | null }
  | { role: 'PIPER'; targets: string[] }

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface GameOptions {
  electSheriff?: boolean
}

export function createGame(names: string[], counts: RoleCounts, options: GameOptions = {}, random = Math.random): GameState {
  const deck = buildDeck(counts, names.length)
  const dealt = shuffle(deck, random)
  return {
    version: GAME_VERSION,
    players: names.map((name, i) => ({ id: `p${i}`, name, role: dealt[i], alive: true })),
    deck,
    leftover: dealt.slice(names.length),
    day: 1,
    step: 0,
    phase: { t: 'NIGHT_START' },
    night: {},
    lastGuarded: null,
    witchHealUsed: false,
    witchPoisonUsed: false,
    lovers: null,
    charmed: [],
    sheriff: null,
    electSheriff: !!options.electSheriff,
    elderHit: false,
    villagePowersLost: false,
    idiotRevealed: false,
    hunterDone: false,
    voters: null,
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

/** The other lover, if `id` is one of the couple. */
export function loverOf(s: GameState, id: string | null | undefined): string | null {
  if (!id || !s.lovers?.includes(id)) return null
  return s.lovers[0] === id ? s.lovers[1] : s.lovers[0]
}

/** Night steps called this game, in calling order. Cards nobody holds are still called, as fake wake-ups. */
export function nightSteps(s: GameState): NightStep[] {
  return NIGHT_ORDER.filter((step) => s.deck.includes(STEP_CARD[step]) && (s.day === 1 || !FIRST_NIGHT_ONLY.includes(step)))
}

const VILLAGE_POWERS: NightStep[] = ['SEER', 'GUARD', 'WITCH']

/**
 * Whether someone actually has to act when this step is called. When false the step is still
 * called and the app waits on its own, so nobody can tell who is dead or which cards are unused.
 */
export function isRealWake(s: GameState, step: NightStep): boolean {
  if (step === 'LOVERS' || step === 'CHARMED') return false
  if (aliveWithRole(s, step).length === 0) return false
  if (s.villagePowersLost && VILLAGE_POWERS.includes(step)) return false
  if (step === 'WITCH') return !s.witchHealUsed || !s.witchPoisonUsed
  if (step === 'PIPER') return nightTargets(s, 'PIPER').length > 0
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
    case 'CUPID':
      return alive
    case 'PIPER':
      return alive.filter((p) => p.role !== 'PIPER' && !s.charmed.includes(p.id))
    case 'THIEF':
      return []
  }
}

/** The Thief must swap when both extra cards are wolves. */
export const thiefMustTake = (s: GameState) => s.leftover.length > 0 && s.leftover.every((r) => r === 'WEREWOLF')

export function hunterTargets(s: GameState): Player[] {
  return alivePlayers(s)
}

/** Players who may be hanged: a revealed Village Idiot can't be. */
export function voteTargets(s: GameState): Player[] {
  return alivePlayers(s).filter((p) => !(p.role === 'IDIOT' && s.idiotRevealed))
}

/** Whether the vote screen offers "tie"; shown whenever the card is in play so it never reveals who is alive. */
export const hasScapegoatCard = (s: GameState) => s.deck.includes('SCAPEGOAT')

/** Who may vote today, as chosen by the Scapegoat; null when everyone may. */
export function todaysVoters(s: GameState): Player[] | null {
  const voters = alivePlayers(s).filter((p) => s.voters?.includes(p.id))
  return voters.length ? voters : null
}

/** Lovers from two different teams, who now play for themselves. */
export function mixedCouple(s: GameState): boolean {
  const [a, b] = (s.lovers ?? []).map((id) => playerById(s, id))
  return !!a && !!b && ROLES[a.role].team !== ROLES[b.role].team
}

export const teamOf = (s: GameState, p: Player): Winner =>
  mixedCouple(s) && s.lovers?.includes(p.id) ? 'LOVERS' : ROLES[p.role].team

/**
 * Checked in this order: the couple, the Piper, the wolves, the village. Wolves win early at
 * parity only when no third party (Piper or mixed couple) is alive; otherwise they must kill them too.
 */
export function winner(s: GameState): Winner | null {
  const alive = alivePlayers(s)
  const teams = alive.map((p) => teamOf(s, p))
  const count = (t: Winner) => teams.filter((x) => x === t).length
  if (count('LOVERS') === 2 && alive.length === 2) return 'LOVERS'
  if (count('PIPER') > 0 && alive.every((p, i) => teams[i] === 'PIPER' || s.charmed.includes(p.id))) return 'PIPER'
  const wolves = count('WOLF')
  const thirdParty = count('PIPER') + count('LOVERS') > 0
  if (wolves > 0 && !thirdParty && wolves >= alive.length - wolves) return 'WOLF'
  if (wolves === 0 && !thirdParty) return 'VILLAGE'
  return null
}

const WIN_LOG: Record<Winner, string> = {
  VILLAGE: 'Phe Dân Làng chiến thắng',
  WOLF: 'Phe Ma Sói chiến thắng',
  PIPER: 'Thổi sáo chiến thắng',
  LOVERS: 'Cặp đôi chiến thắng',
}

const withLog = (s: GameState, text: string): GameState => ({ ...s, log: [...s.log, { day: s.day, text }] })

const goto = (s: GameState, phase: Phase): GameState => ({ ...s, phase, step: s.step + 1 })

/** Kills players; a lover's partner dies of grief. Returns the new state and who died of grief. */
function kill(s: GameState, ids: string[]): { s: GameState; grief: string[] } {
  const grief: string[] = []
  for (const id of ids) {
    const partner = loverOf(s, id)
    if (partner && playerById(s, partner)?.alive && !ids.includes(partner) && !grief.includes(partner)) grief.push(partner)
  }
  const dead = [...ids, ...grief]
  const players = s.players.map((p) => (dead.includes(p.id) ? { ...p, alive: false } : p))
  let next = { ...s, players }
  if (grief.length) next = withLog(next, `${grief.map((id) => nameOf(s, id)).join(', ')} chết theo người yêu`)
  return { s: next, grief }
}

/** The village killed the Elder (hanged, shot or poisoned): village roles lose their powers. */
function checkElder(s: GameState, killedId: string | null | undefined): GameState {
  if (playerById(s, killedId)?.role !== 'ELDER' || s.villagePowersLost) return s
  return withLog({ ...s, villagePowersLost: true }, 'Già làng bị dân làng giết, phe Dân mất hết chức năng')
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
    case 'THIEF': {
      const [thief] = aliveWithRole(s, 'THIEF')
      if (!thief) return s
      if (action.take === null) {
        if (thiefMustTake(s)) throw new Error('Ăn trộm phải đổi vì cả hai lá đều là Ma Sói')
        return withLog(s, 'Ăn trộm giữ nguyên vai')
      }
      const card = s.leftover[action.take]
      if (!card) throw new Error('Không có lá bài này')
      return withLog(
        {
          ...s,
          players: s.players.map((p) => (p.id === thief.id ? { ...p, role: card } : p)),
          leftover: s.leftover.map((r, i) => (i === action.take ? 'THIEF' : r)),
        },
        `Ăn trộm ${thief.name} đổi lấy vai ${ROLES[card].nameVi}`,
      )
    }
    case 'CUPID':
      if (!action.lovers) return withLog(s, 'Cupid không chọn cặp đôi')
      return withLog(
        { ...s, lovers: action.lovers },
        `Cupid ghép đôi ${nameOf(s, action.lovers[0])} và ${nameOf(s, action.lovers[1])}`,
      )
    case 'PIPER': {
      const allowed = new Set(nightTargets(s, 'PIPER').map((p) => p.id))
      const targets = action.targets.filter((id) => allowed.has(id)).slice(0, 2)
      if (!targets.length) return withLog(s, 'Thổi sáo không thôi miên ai')
      return withLog(
        { ...s, charmed: [...s.charmed, ...targets] },
        `Thổi sáo thôi miên ${targets.map((id) => nameOf(s, id)).join(', ')}`,
      )
    }
  }
}

/** Who dies tonight, before grief; `elderHit` when the Elder used up his extra life instead. */
export function resolveNight(s: GameState): { deaths: Death[]; elderHit: boolean } {
  const { wolfTarget, guardTarget, witchHeal, witchPoison } = s.night
  const deaths: Death[] = []
  let elderHit = false
  if (wolfTarget && wolfTarget !== guardTarget && !witchHeal) {
    if (playerById(s, wolfTarget)?.role === 'ELDER' && !s.elderHit) elderHit = true
    else deaths.push({ playerId: wolfTarget, cause: 'WOLF' })
  }
  if (witchPoison && !deaths.some((d) => d.playerId === witchPoison)) {
    deaths.push({ playerId: witchPoison, cause: 'POISON' })
  }
  return { deaths, elderHit }
}

function endNight(s: GameState): GameState {
  const { deaths, elderHit } = resolveNight(s)
  let after: GameState = {
    ...s,
    lastGuarded: s.night.guardTarget ?? null,
    witchHealUsed: s.witchHealUsed || !!s.night.witchHeal,
    witchPoisonUsed: s.witchPoisonUsed || !!s.night.witchPoison,
    elderHit: s.elderHit || elderHit,
  }
  if (elderHit) after = withLog(after, 'Già làng bị cắn nhưng vẫn sống')
  after = checkElder(after, s.night.witchPoison)
  const killed = kill(after, deaths.map((d) => d.playerId))
  const all = [...deaths, ...killed.grief.map((playerId): Death => ({ playerId, cause: 'GRIEF' }))]
  after = withLog(
    killed.s,
    all.length ? `Sáng ngày ${s.day}: ${all.map((d) => nameOf(s, d.playerId)).join(', ')} chết` : `Sáng ngày ${s.day}: không ai chết`,
  )
  return goto(after, { t: 'DAWN', deaths: all })
}

function startNight(s: GameState): GameState {
  const day = s.day + 1
  return goto({ ...s, day, night: {}, log: [...s.log, { day, text: `Đêm thứ ${day}` }] }, { t: 'NIGHT_START' })
}

/**
 * Runs whatever the latest deaths triggered (the Hunter's shot, a new Village Chief), then checks
 * for a winner and moves on to `next`.
 */
function afterDeaths(s: GameState, next: Then): GameState {
  const hunter = s.players.find((p) => p.role === 'HUNTER' && !p.alive)
  if (hunter && !s.hunterDone) {
    if (!s.villagePowersLost) return goto(s, { t: 'HUNTER', hunterId: hunter.id, next })
    s = { ...s, hunterDone: true }
  }
  const sheriff = playerById(s, s.sheriff)
  if (sheriff && !sheriff.alive) {
    if (alivePlayers(s).length > 0) return goto(s, { t: 'SHERIFF_SUCCESSOR', formerId: sheriff.id, next })
    s = { ...s, sheriff: null }
  }
  const team = winner(s)
  if (team) return goto(withLog(s, WIN_LOG[team]), { t: 'ENDED', winner: team })
  if (next === 'NIGHT') return startNight(s)
  if (s.electSheriff) return goto(s, { t: 'SHERIFF_ELECTION' })
  return goto(s, { t: 'DISCUSSION' })
}

/** Moves to the next phase. Phases that need a choice first say so by throwing. */
export function advance(s: GameState): GameState {
  const phase = s.phase
  switch (phase.t) {
    case 'NIGHT_START': {
      const [first] = nightSteps(s)
      return goto(s, { t: 'NIGHT_ROLE', role: first })
    }
    case 'NIGHT_ROLE': {
      const order = nightSteps(s)
      const next = order[order.indexOf(phase.role) + 1]
      if (next) return goto(s, { t: 'NIGHT_ROLE', role: next })
      return endNight(s)
    }
    case 'DAWN':
      return afterDeaths(s, 'DISCUSSION')
    case 'HUNTER':
      if (phase.shot === undefined) throw new Error('Thợ săn chưa chọn')
      return afterDeaths(s, phase.next)
    case 'SHERIFF_ELECTION':
      if (phase.chosen === undefined) throw new Error('Chưa bầu Trưởng làng')
      return goto(s, { t: 'DISCUSSION' })
    case 'SHERIFF_SUCCESSOR':
      if (phase.chosen === undefined) throw new Error('Chưa chọn Trưởng làng mới')
      return afterDeaths(s, phase.next)
    case 'DISCUSSION':
      return goto(s, { t: 'VOTE' })
    case 'VOTE':
      throw new Error('Cần chọn kết quả bỏ phiếu')
    case 'LAST_WORDS': {
      const target = playerById(s, phase.targetId)
      const hanged = checkElder(withLog(s, `Ngày ${s.day}: ${target?.name} bị treo cổ`), phase.targetId)
      const killed = kill(hanged, [phase.targetId])
      return goto(killed.s, { t: 'EXECUTION', targetId: phase.targetId, tie: phase.tie, grief: killed.grief })
    }
    case 'EXECUTION':
      if (phase.tie && phase.targetId) return goto(s, { t: 'SCAPEGOAT', scapegoatId: phase.targetId })
      return afterDeaths(s, 'NIGHT')
    case 'SCAPEGOAT':
      if (phase.chosen === undefined) throw new Error('Kẻ thế mạng chưa chọn')
      return afterDeaths(s, 'NIGHT')
    case 'ENDED':
      return s
  }
}

/** Records the village's decision. `targetId` null means nobody is hanged. */
export function vote(s: GameState, targetId: string | null): GameState {
  if (s.phase.t !== 'VOTE') throw new Error('Không phải lúc bỏ phiếu')
  s = { ...s, voters: null }
  if (!targetId) return goto(withLog(s, `Ngày ${s.day}: không ai bị treo cổ`), { t: 'EXECUTION', targetId: null })
  if (playerById(s, targetId)?.role === 'IDIOT' && !s.idiotRevealed && !s.villagePowersLost) {
    const revealed = withLog({ ...s, idiotRevealed: true }, `Ngày ${s.day}: ${nameOf(s, targetId)} là Thằng ngốc, được tha`)
    return goto(revealed, { t: 'EXECUTION', targetId, spared: true })
  }
  return goto(s, { t: 'LAST_WORDS', targetId })
}

/** A tied vote: the Scapegoat is hanged instead, or nobody when he is dead or not in play. */
export function voteTie(s: GameState): GameState {
  if (s.phase.t !== 'VOTE') throw new Error('Không phải lúc bỏ phiếu')
  const [goat] = aliveWithRole(s, 'SCAPEGOAT')
  if (!goat) return vote(s, null)
  return goto(withLog({ ...s, voters: null }, `Ngày ${s.day}: hoà phiếu`), { t: 'LAST_WORDS', targetId: goat.id, tie: true })
}

export function hunterShoot(s: GameState, targetId: string | null): GameState {
  if (s.phase.t !== 'HUNTER') throw new Error('Không phải lượt Thợ săn')
  const phase = s.phase
  const done = { ...s, hunterDone: true }
  if (!targetId) return withLog({ ...done, phase: { ...phase, shot: null, grief: [] } }, 'Thợ săn không bắn ai')
  const killed = kill(checkElder(withLog(done, `Thợ săn bắn ${nameOf(s, targetId)}`), targetId), [targetId])
  return { ...killed.s, phase: { ...phase, shot: targetId, grief: killed.grief } }
}

/** Elects the first Village Chief, or names a successor; null leaves the village without one. */
export function chooseSheriff(s: GameState, id: string | null): GameState {
  const phase = s.phase
  if (phase.t !== 'SHERIFF_ELECTION' && phase.t !== 'SHERIFF_SUCCESSOR') throw new Error('Không phải lúc chọn Trưởng làng')
  const text = id ? `${nameOf(s, id)} làm Trưởng làng` : 'Làng không có Trưởng làng'
  return withLog({ ...s, sheriff: id, electSheriff: false, phase: { ...phase, chosen: id } }, text)
}

export function scapegoatChoose(s: GameState, voterIds: string[]): GameState {
  if (s.phase.t !== 'SCAPEGOAT') throw new Error('Không phải lượt Kẻ thế mạng')
  const text = `Kẻ thế mạng cho phép ${voterIds.map((id) => nameOf(s, id)).join(', ')} bỏ phiếu ngày mai`
  return withLog({ ...s, voters: voterIds, phase: { ...s.phase, chosen: voterIds } }, text)
}

/** Manual correction from the menu. */
export function setAlive(s: GameState, id: string, alive: boolean): GameState {
  const players = s.players.map((p) => (p.id === id ? { ...p, alive } : p))
  return withLog({ ...s, players }, `${nameOf(s, id)} được ${alive ? 'hồi sinh' : 'đánh dấu chết'} bằng tay`)
}
