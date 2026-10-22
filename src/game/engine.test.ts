import { describe, expect, it } from 'vitest'
import {
  act,
  advance,
  chooseSheriff,
  createGame,
  hunterShoot,
  isRealWake,
  nightTargets,
  scapegoatChoose,
  todaysVoters,
  vote,
  voteTargets,
  voteTie,
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
    expect(s.phase).toEqual({ t: 'EXECUTION', targetId: 'p0', grief: [] })
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

/** Plays a whole night: `actions` are applied when their role is called, other roles do nothing. */
function night(s: GameState, actions: Partial<Record<string, (s: GameState) => GameState>>): GameState {
  if (s.phase.t === 'NIGHT_START') s = advance(s)
  while (s.phase.t === 'NIGHT_ROLE') {
    const f = actions[s.phase.role]
    s = advance(f ? f(s) : s)
  }
  return s
}

describe('thief', () => {
  it('deals two extra cards and calls the thief first, on the first night only', () => {
    const s = createGame(['A', 'B', 'C', 'D', 'E'], { WEREWOLF: 1, THIEF: 1 })
    expect(s.deck).toHaveLength(7)
    expect(s.leftover).toHaveLength(2)
    let g = game(['THIEF', 'WEREWOLF', 'VILLAGER', 'VILLAGER'])
    g = { ...g, deck: [...g.deck, 'SEER', 'VILLAGER'], leftover: ['SEER', 'VILLAGER'] }
    expect(advance(g).phase).toEqual({ t: 'NIGHT_ROLE', role: 'THIEF' })
    expect(advance({ ...g, day: 2 }).phase).toEqual({ t: 'NIGHT_ROLE', role: 'SEER' })
  })

  it('swaps for a leftover card and acts with it the same night', () => {
    let s = game(['THIEF', 'WEREWOLF', 'VILLAGER', 'VILLAGER'])
    s = { ...s, deck: [...s.deck, 'WEREWOLF', 'VILLAGER'], leftover: ['WEREWOLF', 'VILLAGER'] }
    s = toRole(s, 'THIEF')
    s = act(s, { role: 'THIEF', take: 0 })
    expect(s.players[0].role).toBe('WEREWOLF')
    expect(s.leftover).toEqual(['THIEF', 'VILLAGER'])
    expect(nightTargets(s, 'WEREWOLF').map((p) => p.id)).toEqual(['p2', 'p3'])
  })

  it('must swap when both leftover cards are wolves', () => {
    let s = game(['THIEF', 'WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER'])
    s = toRole({ ...s, deck: [...s.deck, 'WEREWOLF', 'WEREWOLF'], leftover: ['WEREWOLF', 'WEREWOLF'] }, 'THIEF')
    expect(() => act(s, { role: 'THIEF', take: null })).toThrow()
  })
})

describe('lovers', () => {
  const roles: RoleId[] = ['CUPID', 'WEREWOLF', 'HUNTER', 'VILLAGER', 'VILLAGER', 'VILLAGER']

  it('calls the couple after Cupid as a fake wake-up', () => {
    const s = toRole(game(roles), 'LOVERS')
    expect(isRealWake(s, 'LOVERS')).toBe(false)
  })

  it('kills the partner of a bitten lover, and a hunter who dies of grief still shoots', () => {
    let s = night(game(roles), {
      CUPID: (s) => act(s, { role: 'CUPID', lovers: ['p3', 'p2'] }),
      WEREWOLF: (s) => act(s, { role: 'WEREWOLF', target: 'p3' }),
    })
    expect(s.phase).toEqual({
      t: 'DAWN',
      deaths: [
        { playerId: 'p3', cause: 'WOLF' },
        { playerId: 'p2', cause: 'GRIEF' },
      ],
    })
    s = advance(s)
    expect(s.phase).toEqual({ t: 'HUNTER', hunterId: 'p2', next: 'DISCUSSION' })
  })

  it('a hanged lover takes the partner along', () => {
    let s = night(game(roles), { CUPID: (s) => act(s, { role: 'CUPID', lovers: ['p4', 'p5'] }) })
    s = advance(advance(s))
    s = advance(vote(s, 'p4'))
    expect(s.phase).toEqual({ t: 'EXECUTION', targetId: 'p4', grief: ['p5'] })
    expect(s.players[5].alive).toBe(false)
  })

  it('a wolf and a villager in love win as the last two alive, and stop the wolves winning early', () => {
    let s = game(['WEREWOLF', 'WEREWOLF', 'VILLAGER', 'VILLAGER'])
    s = { ...s, lovers: ['p1', 'p2'] }
    expect(winner(s)).toBeNull()
    const kill = (s: GameState, i: number) => ({ ...s, players: s.players.map((p, j) => (j === i ? { ...p, alive: false } : p)) })
    expect(winner(kill(s, 3))).toBeNull()
    expect(winner(kill(kill(s, 3), 0))).toBe('LOVERS')
  })
})

describe('piper', () => {
  it('charms two players a night and wins when everyone alive is charmed', () => {
    let s = game(['PIPER', 'WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER'])
    s = night(s, { PIPER: (s) => act(s, { role: 'PIPER', targets: ['p1', 'p2'] }) })
    expect(s.charmed).toEqual(['p1', 'p2'])
    s = advance(s)
    expect(s.phase.t).toBe('DISCUSSION')
    s = advance(vote(advance(s), null))
    s = night(s, { PIPER: (s) => act(s, { role: 'PIPER', targets: ['p3', 'p4'] }) })
    expect(advance(s).phase).toEqual({ t: 'ENDED', winner: 'PIPER' })
  })

  it('keeps the village from winning while alive', () => {
    const s = game(['PIPER', 'VILLAGER', 'VILLAGER'])
    expect(winner(s)).toBeNull()
  })
})

describe('elder', () => {
  const roles: RoleId[] = ['ELDER', 'WEREWOLF', 'SEER', 'HUNTER', 'VILLAGER', 'VILLAGER', 'VILLAGER']

  it('survives the first bite, not the second', () => {
    let s = night(game(roles), { WEREWOLF: (s) => act(s, { role: 'WEREWOLF', target: 'p0' }) })
    expect(s.phase).toEqual({ t: 'DAWN', deaths: [] })
    expect(s.elderHit).toBe(true)
    s = advance(vote(advance(advance(s)), null))
    s = night(s, { WEREWOLF: (s) => act(s, { role: 'WEREWOLF', target: 'p0' }) })
    expect(s.phase).toEqual({ t: 'DAWN', deaths: [{ playerId: 'p0', cause: 'WOLF' }] })
  })

  it('hanged by the village: village roles lose their powers', () => {
    let s = toRole(game(roles), 'WEREWOLF')
    s = advance(advance(s))
    s = advance(advance(vote(advance(s), 'p0')))
    expect(s.villagePowersLost).toBe(true)
    expect(isRealWake(s, 'SEER')).toBe(false)
    s = night(s, { WEREWOLF: (s) => act(s, { role: 'WEREWOLF', target: 'p3' }) })
    expect(advance(s).phase.t).toBe('DISCUSSION')
  })
})

describe('idiot', () => {
  it('is spared when hanged, then cannot be voted again', () => {
    let s = toRole(game(['IDIOT', 'WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER']), 'WEREWOLF')
    s = advance(advance(s))
    s = vote(advance(s), 'p0')
    expect(s.phase).toEqual({ t: 'EXECUTION', targetId: 'p0', spared: true })
    expect(s.players[0].alive).toBe(true)
    expect(voteTargets(s).map((p) => p.id)).not.toContain('p0')
  })
})

describe('scapegoat', () => {
  const roles: RoleId[] = ['SCAPEGOAT', 'WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER']

  it('is hanged on a tie, then picks tomorrow’s voters', () => {
    let s = toRole(game(roles), 'WEREWOLF')
    s = advance(advance(s))
    s = voteTie(advance(s))
    expect(s.phase).toEqual({ t: 'LAST_WORDS', targetId: 'p0', tie: true })
    s = advance(advance(s))
    expect(s.phase).toEqual({ t: 'SCAPEGOAT', scapegoatId: 'p0' })
    s = advance(scapegoatChoose(s, ['p2', 'p3']))
    expect(todaysVoters(s)?.map((p) => p.id)).toEqual(['p2', 'p3'])
    expect(s.phase.t).toBe('NIGHT_START')
  })

  it('a tie with the scapegoat dead hangs nobody', () => {
    let s = toRole(game(roles), 'WEREWOLF')
    s = advance(advance(act(s, { role: 'WEREWOLF', target: 'p0' })))
    s = voteTie(advance(s))
    expect(s.phase).toEqual({ t: 'EXECUTION', targetId: null })
  })
})

describe('village chief', () => {
  it('is elected on the first morning and replaced when he dies', () => {
    let s = { ...game(['WEREWOLF', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER', 'VILLAGER']), electSheriff: true }
    s = advance(toRole(s, 'WEREWOLF'))
    s = advance(s)
    expect(s.phase.t).toBe('SHERIFF_ELECTION')
    s = advance(chooseSheriff(s, 'p1'))
    expect(s.phase.t).toBe('DISCUSSION')
    s = advance(advance(vote(advance(s), 'p1')))
    expect(s.phase).toEqual({ t: 'SHERIFF_SUCCESSOR', formerId: 'p1', next: 'NIGHT' })
    s = advance(chooseSheriff(s, 'p2'))
    expect(s.sheriff).toBe('p2')
    expect(s.phase.t).toBe('NIGHT_START')
    expect(s.electSheriff).toBe(false)
  })
})
