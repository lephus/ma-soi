export type RoleId =
  | 'VILLAGER'
  | 'WEREWOLF'
  | 'SEER'
  | 'GUARD'
  | 'WITCH'
  | 'HUNTER'
  | 'CUPID'
  | 'LITTLE_GIRL'
  | 'THIEF'
  | 'ELDER'
  | 'IDIOT'
  | 'SCAPEGOAT'
  | 'PIPER'
export type Team = 'VILLAGE' | 'WOLF' | 'PIPER'
/** A couple from two different teams plays for itself. */
export type Winner = Team | 'LOVERS'

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
  CUPID: {
    id: 'CUPID',
    nameVi: 'Cupid',
    team: 'VILLAGE',
    unique: true,
    icon: '💘',
    description:
      'Đêm đầu chọn hai người làm cặp đôi. Một người chết thì người kia chết theo. Cặp đôi khác phe thì thắng khi chỉ còn hai người họ.',
  },
  LITTLE_GIRL: {
    id: 'LITTLE_GIRL',
    nameVi: 'Cô bé',
    team: 'VILLAGE',
    unique: true,
    icon: '👧',
    description: 'Được hé mắt nhìn lúc Ma Sói thức dậy. Nếu bị Sói bắt gặp thì rất nguy hiểm.',
  },
  THIEF: {
    id: 'THIEF',
    nameVi: 'Ăn trộm',
    team: 'VILLAGE',
    unique: true,
    icon: '🦝',
    description:
      'Đêm đầu được xem hai lá bài thừa và đổi lấy một lá. Nếu cả hai đều là Ma Sói thì bắt buộc phải đổi. Không đổi thì làm Dân làng.',
  },
  ELDER: {
    id: 'ELDER',
    nameVi: 'Già làng',
    team: 'VILLAGE',
    unique: true,
    icon: '👴',
    description:
      'Chịu được một lần bị Sói cắn. Nếu bị dân làng giết (treo cổ, Thợ săn bắn, Phù thủy độc) thì cả phe Dân mất chức năng.',
  },
  IDIOT: {
    id: 'IDIOT',
    nameVi: 'Thằng ngốc',
    team: 'VILLAGE',
    unique: true,
    icon: '🤪',
    description: 'Bị treo cổ thì lật bài và được tha, nhưng từ đó mất quyền bỏ phiếu.',
  },
  SCAPEGOAT: {
    id: 'SCAPEGOAT',
    nameVi: 'Kẻ thế mạng',
    team: 'VILLAGE',
    unique: true,
    icon: '🐐',
    description: 'Khi bỏ phiếu hoà thì bị treo cổ thay, rồi được chọn những ai được bỏ phiếu ngày hôm sau.',
  },
  PIPER: {
    id: 'PIPER',
    nameVi: 'Thổi sáo',
    team: 'PIPER',
    unique: true,
    icon: '🪈',
    description: 'Phe riêng. Mỗi đêm thôi miên hai người. Thắng khi mọi người còn sống đều đã bị thôi miên.',
  },
}

/** Roles shown in the setup screen, villagers last because they fill the remaining seats. */
export const CONFIGURABLE_ROLES: RoleId[] = [
  'WEREWOLF',
  'SEER',
  'GUARD',
  'WITCH',
  'HUNTER',
  'CUPID',
  'LITTLE_GIRL',
  'THIEF',
  'ELDER',
  'IDIOT',
  'SCAPEGOAT',
  'PIPER',
]

/**
 * Night steps in calling order. LOVERS and CHARMED are not roles: the couple, and everyone the
 * Piper has charmed, open their eyes to see each other while the app just waits.
 */
export const NIGHT_ORDER = ['THIEF', 'CUPID', 'LOVERS', 'SEER', 'GUARD', 'WEREWOLF', 'WITCH', 'PIPER', 'CHARMED'] as const
export type NightStep = (typeof NIGHT_ORDER)[number]
/** Steps where someone holds the phone and acts. */
export type NightRole = Exclude<NightStep, 'LOVERS' | 'CHARMED'>

/** The card a step belongs to: a step is only called when that card is in the deck. */
export const STEP_CARD: Record<NightStep, RoleId> = {
  THIEF: 'THIEF',
  CUPID: 'CUPID',
  LOVERS: 'CUPID',
  SEER: 'SEER',
  GUARD: 'GUARD',
  WEREWOLF: 'WEREWOLF',
  WITCH: 'WITCH',
  PIPER: 'PIPER',
  CHARMED: 'PIPER',
}

export const FIRST_NIGHT_ONLY: NightStep[] = ['THIEF', 'CUPID', 'LOVERS']

/** The Thief adds two extra cards to the deck, which nobody holds. */
export const THIEF_EXTRA_CARDS = 2

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

export const deckSize = (counts: RoleCounts, playerCount: number) =>
  playerCount + (counts.THIEF ? THIEF_EXTRA_CARDS : 0)

export function buildDeck(counts: RoleCounts, playerCount: number): RoleId[] {
  const deck: RoleId[] = []
  for (const role of CONFIGURABLE_ROLES) {
    for (let i = 0; i < (counts[role] ?? 0); i++) deck.push(role)
  }
  while (deck.length < deckSize(counts, playerCount)) deck.push('VILLAGER')
  return deck
}

/** Returns an error message in Vietnamese, or null when the setup can start. */
export function validateSetup(counts: RoleCounts, playerCount: number): string | null {
  if (playerCount < 4) return 'Cần ít nhất 4 người chơi'
  const wolves = counts.WEREWOLF ?? 0
  if (wolves < 1) return 'Cần ít nhất 1 Ma Sói'
  const specials = CONFIGURABLE_ROLES.reduce((sum, r) => sum + (counts[r] ?? 0), 0)
  const cards = deckSize(counts, playerCount)
  if (specials > cards) return `Có ${specials} vai nhưng chỉ có ${cards} lá bài`
  if (wolves * 2 >= playerCount) return 'Số Ma Sói phải ít hơn một nửa số người chơi'
  return null
}
