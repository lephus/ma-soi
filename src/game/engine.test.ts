import { describe, expect, it } from 'vitest'
import {
  act,
  advance,
  createGame,
  hunterShoot,
  isRealWake,
  nightTargets,
  vote,
  winner,
  type GameState,
} from './engine'
import type { RoleId } from './roles'
import { suggestRoles, validateSetup } from './roles'

/** Builds a game with fixed roles: players are named after their index, p0..pN. */
function game(roles: RoleId[]): GameState {
  const s = createGame(roles.map((_, i) => `P${i}`), {})
  return { ...s, deck: roles, players: roles.map((role, i) => ({ id: `p${i}`, name: `P${i}`, role, alive: true })) }
}

const phaseOf = (s: GameState) => (s.phase.t === 'NIGHT_ROLE' ? `NIGHT_ROLE:${s.phase.role}` : s.phase.t)

/** Advances to the given night role, taking no action on the roles before it. */
function toRole(s: GameState, role: string): GameState {
  if (s.phase.t === 'NIGHT_START') s = advance(s)
  while (phaseOf(s) !== `NIGHT_ROLE:${role}`) s = advance(s)
  return s
}

describe('setup', () => {
  it('deals exactly the configured deck', () => {
    const s = createGame(['A', 'B', 'C', 'D', 'E', 'F'], { WEREWOLF: 2, SEER: 1 })
    const roles = s.players.map((p) => p.role).sort()
    expect(roles).toEqual(['SEER', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'WEREWOLF', 'WEREWOLF'])
  })

  it('suggests a valid deck for every table size', () => {
    for (let n = 4; n <= 16; n++) expect(validateSetup(suggestRoles(n), n)).toBeNull()
  })

  it('rejects too many wolves', () => {
    expect(validateSetup({ WEREWOLF: 3 }, 6)).not.toBeNull()
  })
})

describe('night order', () => {
  it('calls only roles in the deck, in order', () => {
    let s = game(['WEREWOLF', 'WITCH', 'SEER', 'VILLAGER', 'VILLAGER'])
    const calls: string[] = []
    s = advance(s)
    while (s.phase.t === 'NIGHT_ROLE') {
      calls.push(s.phase.role)
      s = advance(s)
    }
    expect(calls).toEqual(['SEER', 'WEREWOLF', 'WITCH'])
    expect(s.phase.t).toBe('DAWN')
  })

  it('still calls a dead role, but as a fake wake-up', () => {
    let s = game(['WEREWOLF', 'SEER', 'VILLAGER', 'VILLAGER', 'VILLAGER'])
    s = { ...s, players: s.players.map((p) => (p.role === 'SEER' ? { ...p, alive: false } : p)) }
    expect(advance(s).phase).toEqual({ t: 'NIGHT_ROLE', role: 'SEER' })
    expect(isRealWake(s, 'SEER')).toBe(false)
  })

  it('treats a witch with no potions left as a fake wake-up', () => {
    const s = { ...game(['WEREWOLF', 'WITCH', 'VILLAGER', 'VILLAGER']), witchHealUsed: true, witchPoisonUsed: true }
    expect(isRealWake(s, 'WITCH')).toBe(false)
  })
})

describe('night resolution', () => {
  const roles: RoleId[] = ['WEREWOLF', 'GUARD', 'WITCH', 'VILLAGER', 'VILLAGER', 'VILLAGER']

  it('kills the wolf target', () => {
    let s = toRole(game(roles), 'WEREWOLF')
    s = advance(act(s, { role: 'WEREWOLF', target: 'p3' }))
    s = advance(act(s, { role: 'WITCH', heal: false, poison: null }))
    expect(s.phase).toEqual({ t: 'DAWN', deaths: [{ playerId: 'p3', cause: 'WOLF' }] })
    expect(s.players[3].alive).toBe(false)
  })

  it('guard protects the wolf target, and cannot guard the same person next night', () => {
    let s = toRole(game(roles), 'GUARD')
    s = advance(act(s, { role: 'GUARD', target: 'p3' }))
    s = advance(act(s, { role: 'WEREWOLF', target: 'p3' }))
    s = advance(act(s, { role: 'WITCH', heal: false, poison: null }))
    expect(s.phase).toEqual({ t: 'DAWN', deaths: [] })
    expect(s.lastGuarded).toBe('p3')
    expect(nightTargets(s, 'GUARD').map((p) => p.id)).not.toContain('p3')
  })

  it('witch heals once and poisons once', () => {
    let s = toRole(game(roles), 'WEREWOLF')
    s = advance(act(s, { role: 'WEREWOLF', target: 'p3' }))
    s = advance(act(s, { role: 'WITCH', heal: true, poison: 'p0' }))
    expect(s.phase).toEqual({ t: 'DAWN', deaths: [{ playerId: 'p0', cause: 'POISON' }] })
    expect(s.witchHealUsed && s.witchPoisonUsed).toBe(true)
    expect(winner(s)).toBe('VILLAGE')
  })

  it('wolves cannot target other wolves', () => {
    const s = game(['WEREWOLF', 'WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER'])
    expect(nightTargets(s, 'WEREWOLF').map((p) => p.id)).toEqual(['p2', 'p3', 'p4'])
  })
})

describe('day', () => {
  it('runs discussion, vote, last words, execution, then the next night', () => {
    let s = game(['WEREWOLF', 'WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER'])
    s = toRole(s, 'WEREWOLF')
    s = advance(act(s, { role: 'WEREWOLF', target: 'p2' }))
    s = advance(s)
    expect(s.phase.t).toBe('DISCUSSION')
    s = vote(advance(s), 'p0')
    expect(s.phase).toEqual({ t: 'LAST_WORDS', targetId: 'p0' })
    s = advance(s)
    expect(s.phase).toEqual({ t: 'EXECUTION', targetId: 'p0' })
    expect(s.players[0].alive).toBe(false)
    s = advance(s)
    expect(s.phase.t).toBe('NIGHT_START')
    expect(s.day).toBe(2)
    expect(s.night).toEqual({})
  })

  it('skipping the vote hangs nobody', () => {
    let s = toRole(game(['WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER']), 'WEREWOLF')
    s = advance(advance(s))
    s = vote(advance(s), null)
    expect(s.phase).toEqual({ t: 'EXECUTION', targetId: null })
    expect(s.players.every((p) => p.alive)).toBe(true)
  })

  it('wolves win at parity', () => {
    let s = toRole(game(['WEREWOLF', 'VILLAGER', 'VILLAGER']), 'WEREWOLF')
    s = advance(act(s, { role: 'WEREWOLF', target: 'p1' }))
    s = advance(s)
    expect(s.phase).toEqual({ t: 'ENDED', winner: 'WOLF' })
  })
})

describe('hunter', () => {
  it('shoots after being bitten, before the win check', () => {
    let s = game(['WEREWOLF', 'HUNTER', 'VILLAGER', 'VILLAGER'])
    s = toRole(s, 'WEREWOLF')
    s = advance(act(s, { role: 'WEREWOLF', target: 'p1' }))
    s = advance(s)
    expect(s.phase).toEqual({ t: 'HUNTER', hunterId: 'p1', next: 'DISCUSSION' })
    expect(() => advance(s)).toThrow()
    s = advance(hunterShoot(s, 'p0'))
    expect(s.phase).toEqual({ t: 'ENDED', winner: 'VILLAGE' })
  })

  it('shoots after being hanged, then night falls', () => {
    let s = game(['WEREWOLF', 'HUNTER', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'WEREWOLF', 'VILLAGER'])
    s = toRole(s, 'WEREWOLF')
    s = advance(advance(s))
    s = advance(vote(advance(s), 'p1'))
    s = advance(s)
    expect(s.phase).toEqual({ t: 'HUNTER', hunterId: 'p1', next: 'NIGHT' })
    s = advance(hunterShoot(s, null))
    expect(s.phase.t).toBe('NIGHT_START')
    expect(s.day).toBe(2)
  })
})
