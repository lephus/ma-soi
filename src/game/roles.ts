export type RoleId = 'VILLAGER' | 'WEREWOLF' | 'SEER' | 'GUARD' | 'WITCH' | 'HUNTER'
export type Team = 'VILLAGE' | 'WOLF'

export interface RoleInfo {
  id: RoleId
  nameVi: string
  team: Team
  /** Only one copy of this role may be in the deck. */
  unique: boolean
  icon: string
  description: string
}

export const ROLES: Record<RoleId, RoleInfo> = {
  VILLAGER: {
    id: 'VILLAGER',
    nameVi: 'Dân làng',
    team: 'VILLAGE',
    unique: false,
    icon: '🧑‍🌾',
    description: 'Không có chức năng đặc biệt. Hãy tìm ra Ma Sói và treo cổ chúng vào ban ngày.',
  },
  WEREWOLF: {
    id: 'WEREWOLF',
    nameVi: 'Ma Sói',
    team: 'WOLF',
    unique: false,
    icon: '🐺',
    description: 'Mỗi đêm cùng đồng bọn chọn một người để cắn. Thắng khi số Sói bằng hoặc nhiều hơn số Dân.',
  },
  SEER: {
    id: 'SEER',
    nameVi: 'Tiên tri',
    team: 'VILLAGE',
    unique: true,
    icon: '🔮',
    description: 'Mỗi đêm được soi một người để biết người đó có phải là Ma Sói hay không.',
  },
  GUARD: {
    id: 'GUARD',
    nameVi: 'Bảo vệ',
    team: 'VILLAGE',
    unique: true,
    icon: '🛡️',
    description: 'Mỗi đêm chọn một người để bảo vệ khỏi Ma Sói. Không được bảo vệ cùng một người hai đêm liền.',
  },
  WITCH: {
    id: 'WITCH',
    nameVi: 'Phù thủy',
    team: 'VILLAGE',
    unique: true,
    icon: '🧪',
    description: 'Có một bình cứu và một bình độc, mỗi bình chỉ dùng được một lần trong cả ván.',
  },
  HUNTER: {
    id: 'HUNTER',
    nameVi: 'Thợ săn',
    team: 'VILLAGE',
    unique: true,
    icon: '🏹',
    description: 'Khi chết (bị cắn, bị độc hoặc bị treo cổ) được bắn chết một người bất kỳ.',
  },
}

/** Roles shown in the setup screen, villagers last because they fill the remaining seats. */
export const CONFIGURABLE_ROLES: RoleId[] = ['WEREWOLF', 'SEER', 'GUARD', 'WITCH', 'HUNTER']

/** Roles called at night, in calling order. */
export const NIGHT_ORDER = ['SEER', 'GUARD', 'WEREWOLF', 'WITCH'] as const
export type NightRole = (typeof NIGHT_ORDER)[number]

export type RoleCounts = Partial<Record<RoleId, number>>

/** Suggested deck for a number of players. Villagers fill whatever is left. */
export function suggestRoles(playerCount: number): RoleCounts {
  const counts: RoleCounts = { WEREWOLF: Math.max(1, Math.floor(playerCount / 3.5)) }
  if (playerCount >= 4) counts.SEER = 1
  if (playerCount >= 5) counts.GUARD = 1
  if (playerCount >= 7) counts.WITCH = 1
  if (playerCount >= 8) counts.HUNTER = 1
  return counts
}

export function buildDeck(counts: RoleCounts, playerCount: number): RoleId[] {
  const deck: RoleId[] = []
  for (const role of CONFIGURABLE_ROLES) {
    for (let i = 0; i < (counts[role] ?? 0); i++) deck.push(role)
  }
  while (deck.length < playerCount) deck.push('VILLAGER')
  return deck
}

/** Returns an error message in Vietnamese, or null when the setup can start. */
export function validateSetup(counts: RoleCounts, playerCount: number): string | null {
  if (playerCount < 4) return 'Cần ít nhất 4 người chơi'
  const wolves = counts.WEREWOLF ?? 0
  if (wolves < 1) return 'Cần ít nhất 1 Ma Sói'
  const specials = CONFIGURABLE_ROLES.reduce((sum, r) => sum + (counts[r] ?? 0), 0)
  if (specials > playerCount) return `Có ${specials} vai nhưng chỉ có ${playerCount} người chơi`
  if (wolves * 2 >= playerCount) return 'Số Ma Sói phải ít hơn một nửa số người chơi'
  return null
}
