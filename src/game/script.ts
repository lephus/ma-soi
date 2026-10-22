import { createGame, nameOf, type Death, type GameState } from './engine'
import { ROLES, type NightStep, type Winner } from './roles'

/** What the narrator says. Nothing secret (seer results, who was bitten) is ever spoken. */

/**
 * A line is either plain text or a list of parts joined without separators. Splitting a line
 * keeps player names apart from the fixed wording, so the fixed parts can use recorded clips.
 */
export type Line = string | string[]

export const lineParts = (line: Line): string[] => (typeof line === 'string' ? [line] : line)
export const lineText = (line: Line): string => lineParts(line).join('')

/** The text a part is recorded and looked up under; empty for parts that are only punctuation. */
export function phraseKey(part: string): string {
  const key = part.trim().replace(/^[,.\s]+/, '')
  return /[\p{L}\p{N}]/u.test(key) ? key : ''
}

function durationParts(seconds: number): string[] {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return [`${s} giây`]
  return s === 0 ? [`${m} phút`] : [`${m} phút`, ` ${s} giây`]
}

export const formatDuration = (seconds: number): string => durationParts(seconds).join('')

export function nightStartLines(day: number): string[] {
  return [`Đêm thứ ${day === 1 ? 'nhất' : day === 4 ? 'tư' : day}.`, 'Màn đêm buông xuống. Cả làng hãy nhắm mắt lại.']
}

const WAKE: Record<NightStep, string[]> = {
  THIEF: ['Ăn trộm hãy thức dậy.', 'Ăn trộm hãy cầm điện thoại, xem hai lá bài thừa và chọn có đổi vai hay không.'],
  CUPID: ['Cupid hãy thức dậy.', 'Cupid hãy cầm điện thoại và chọn hai người làm cặp đôi.'],
  LOVERS: ['Hai người vừa được Cupid chạm vào hãy mở mắt và nhìn nhau. Các bạn là một cặp đôi.'],
  SEER: ['Tiên tri hãy thức dậy.', 'Tiên tri hãy cầm điện thoại và chọn một người để soi.'],
  GUARD: ['Bảo vệ hãy thức dậy.', 'Bảo vệ hãy cầm điện thoại và chọn một người để bảo vệ đêm nay.'],
  WEREWOLF: ['Ma Sói hãy thức dậy và nhìn mặt đồng bọn.', 'Ma Sói hãy thống nhất, rồi chọn một người để cắn.'],
  WITCH: ['Phù thủy hãy thức dậy.', 'Phù thủy hãy cầm điện thoại. Bạn có muốn dùng bình cứu hay bình độc không?'],
  PIPER: ['Thổi sáo hãy thức dậy.', 'Thổi sáo hãy cầm điện thoại và chọn hai người để thôi miên.'],
  CHARMED: ['Những người bị thôi miên hãy mở mắt và nhìn nhau.'],
}

const SLEEP: Record<NightStep, string> = {
  THIEF: 'Ăn trộm hãy đặt điện thoại xuống và nhắm mắt lại.',
  CUPID: 'Cupid hãy đặt điện thoại xuống, chạm nhẹ vào vai hai người được chọn, rồi nhắm mắt lại.',
  LOVERS: 'Cặp đôi hãy nhắm mắt lại.',
  SEER: 'Tiên tri hãy đặt điện thoại xuống và nhắm mắt lại.',
  GUARD: 'Bảo vệ hãy đặt điện thoại xuống và nhắm mắt lại.',
  WEREWOLF: 'Ma Sói hãy đặt điện thoại xuống và nhắm mắt lại.',
  WITCH: 'Phù thủy hãy đặt điện thoại xuống và nhắm mắt lại.',
  PIPER: 'Thổi sáo hãy đặt điện thoại xuống, chạm nhẹ vào vai những người vừa bị thôi miên, rồi nhắm mắt lại.',
  CHARMED: 'Những người bị thôi miên hãy nhắm mắt lại.',
}

export const wakeLines = (step: NightStep) => WAKE[step]
export const sleepLines = (step: NightStep) => [SLEEP[step]]

function deathLabel(s: GameState, playerId: string, revealRole: boolean): string[] {
  const p = s.players.find((x) => x.id === playerId)
  if (!p) return ['Không rõ']
  return revealRole ? [p.name, `, vai ${ROLES[p.role].nameVi}`] : [p.name]
}

export function dawnLines(s: GameState, deaths: Death[], revealRole: boolean): Line[] {
  const lines: Line[] = ['Trời đã sáng. Cả làng hãy mở mắt.']
  if (deaths.length === 0) {
    lines.push('Đêm qua là một đêm bình yên. Không có ai chết.')
  } else {
    const killed = deaths.filter((d) => d.cause !== 'GRIEF').map((d) => d.playerId)
    lines.push(['Đêm qua, ', ...joinNames(killed.map((id) => deathLabel(s, id, revealRole))), ' đã chết.'])
    lines.push(...griefLines(s, deaths.filter((d) => d.cause === 'GRIEF').map((d) => d.playerId), revealRole))
  }
  return lines
}

function griefLines(s: GameState, ids: string[], revealRole: boolean): Line[] {
  return ids.map((id) => [...deathLabel(s, id, revealRole), ' đã chết vì đau buồn theo người mình yêu.'])
}

export function hunterWakeLines(s: GameState, hunterId: string): Line[] {
  return [[nameOf(s, hunterId), ' là Thợ săn.'], 'Thợ săn hãy cầm điện thoại và chọn một người để bắn theo.']
}

export function hunterResultLines(s: GameState, shot: string | null, grief: string[], revealRole: boolean): Line[] {
  if (!shot) return ['Thợ săn đã quyết định không bắn ai.']
  return [['Thợ săn đã bắn chết ', ...deathLabel(s, shot, revealRole), '.'], ...griefLines(s, grief, revealRole)]
}

export function sheriffElectionLines(seconds: number): Line[] {
  return [
    'Trước khi thảo luận, cả làng hãy bầu một Trưởng làng. Phiếu của Trưởng làng được tính gấp đôi.',
    ['Các bạn có ', ...durationParts(seconds), '.'],
  ]
}

export const sheriffElectionEndLines = ['Hết giờ. Hãy chọn Trưởng làng trên điện thoại.']

export function sheriffSuccessorLines(s: GameState, formerId: string): Line[] {
  return [['Trưởng làng ', nameOf(s, formerId), ' đã chết.'], 'Trưởng làng hãy chọn người kế nhiệm trên điện thoại.']
}

export function sheriffResultLines(s: GameState, chosen: string | null): Line[] {
  if (!chosen) return ['Làng không có Trưởng làng.']
  return [[nameOf(s, chosen), ' là Trưởng làng. Phiếu của Trưởng làng được tính gấp đôi.']]
}

export function scapegoatLines(s: GameState, scapegoatId: string): Line[] {
  return [[nameOf(s, scapegoatId), ' hãy chọn trên điện thoại những người được bỏ phiếu ngày mai.']]
}

export function scapegoatResultLines(s: GameState, voterIds: string[]): Line[] {
  return [['Ngày mai chỉ ', ...joinNames(voterIds.map((id) => [nameOf(s, id)])), ' được bỏ phiếu.']]
}

export function discussionLines(seconds: number): Line[] {
  return [['Bắt đầu thảo luận. Cả làng có ', ...durationParts(seconds), '.']]
}

export const discussionEndLines = ['Hết giờ thảo luận.']

/** `voters`: names of the only players allowed to vote today, chosen by the Scapegoat. */
export function voteLines(seconds: number, voters: string[] | null = null): Line[] {
  const lines: Line[] = [['Bây giờ cả làng hãy bỏ phiếu. Các bạn có ', ...durationParts(seconds), '.']]
  if (voters) lines.push(['Theo lựa chọn của Kẻ thế mạng, hôm nay chỉ ', ...joinNames(voters.map((n) => [n])), ' được bỏ phiếu.'])
  return lines
}

export const voteEndLines = ['Hết giờ bỏ phiếu. Hãy chọn người bị treo cổ trên điện thoại.']

export function lastWordsLines(s: GameState, targetId: string, seconds: number, tie = false): Line[] {
  const name = nameOf(s, targetId)
  return [
    tie ? ['Hoà phiếu. ', name, ' là Kẻ thế mạng nên phải chịu treo cổ.'] : [name, ' bị nhiều phiếu nhất.'],
    [name, ' có ', ...durationParts(seconds), ' để nói lời cuối.'],
  ]
}

export function executionLines(
  s: GameState,
  targetId: string | null,
  revealRole: boolean,
  { spared = false, grief = [] }: { spared?: boolean; grief?: string[] } = {},
): Line[] {
  if (!targetId) return ['Hôm nay cả làng không treo cổ ai.']
  const name = nameOf(s, targetId)
  if (spared) return [[name, ' là Thằng ngốc.'], [name, ' được tha chết, nhưng từ nay mất quyền bỏ phiếu.']]
  return [[...deathLabel(s, targetId, revealRole), ' đã bị cả làng treo cổ.'], ...griefLines(s, grief, revealRole)]
}

const WIN_LINES: Record<Winner, string> = {
  WOLF: 'Phe Ma Sói chiến thắng. Bóng tối đã bao trùm ngôi làng.',
  VILLAGE: 'Phe Dân Làng chiến thắng. Ngôi làng đã sạch bóng Ma Sói.',
  PIPER: 'Thổi sáo chiến thắng. Cả làng đã bị thôi miên.',
  LOVERS: 'Cặp đôi chiến thắng. Tình yêu đã vượt qua tất cả.',
}

export function endLines(winner: Winner): string[] {
  return ['Trò chơi kết thúc.', WIN_LINES[winner]]
}

/** Spoken reminders while a timer runs, keyed by seconds remaining. */
export function timerWarning(remaining: number, total: number): string | null {
  if (remaining === 60 && total > 90) return 'Còn một phút.'
  if (remaining === 30 && total > 45) return 'Còn 30 giây.'
  if (remaining === 10 && total > 15) return 'Còn 10 giây.'
  return null
}

function joinNames(names: string[][]): string[] {
  return names.flatMap((name, i) => (i === 0 ? name : [i === names.length - 1 ? ' và ' : ', ', ...name]))
}

/** Recorded clips cover nights up to this number and timers up to this many minutes. */
export const MAX_RECORDED_DAY = 30
export const MAX_RECORDED_MINUTES = 20

/**
 * Every fixed part the narrator can say, i.e. everything except player names.
 * `npm run gen-voice` records one clip per phrase.
 */
export function allPhrases(): string[] {
  const roles = Object.keys(ROLES) as (keyof typeof ROLES)[]
  // One placeholder player per role, so every "vai …" label is said at least once.
  const players = roles.map((role, i) => ({ id: `p${i}`, name: `\u0000${i}`, role, alive: true }))
  const s = { ...createGame(players.map((p) => p.name), {}), players }
  const ids = players.map((p) => p.id)
  const names = s.players.map((p) => p.name)
  const deaths = ids.map((playerId, i): Death => ({ playerId, cause: i % 2 ? 'GRIEF' : 'WOLF' }))
  const lines: Line[] = []
  for (let day = 1; day <= MAX_RECORDED_DAY; day++) lines.push(...nightStartLines(day))
  for (const step of Object.keys(WAKE) as NightStep[]) lines.push(...wakeLines(step), ...sleepLines(step))
  for (let seconds = 1; seconds <= MAX_RECORDED_MINUTES * 60; seconds++) {
    lines.push(...discussionLines(seconds), ...voteLines(seconds, names), ...sheriffElectionLines(seconds))
    lines.push(...lastWordsLines(s, ids[0], seconds), ...lastWordsLines(s, ids[0], seconds, true))
    lines.push(timerWarning(seconds, MAX_RECORDED_MINUTES * 60) ?? '')
  }
  for (const reveal of [false, true]) {
    lines.push(...dawnLines(s, [], reveal), ...dawnLines(s, deaths, reveal), ...hunterResultLines(s, null, [], reveal))
    lines.push(...executionLines(s, null, reveal))
    for (const id of ids) {
      lines.push(...hunterResultLines(s, id, ids, reveal), ...executionLines(s, id, reveal, { grief: ids }))
      lines.push(...executionLines(s, id, reveal, { spared: true }))
    }
  }
  lines.push(...sheriffElectionEndLines, ...sheriffSuccessorLines(s, ids[0]), ...sheriffResultLines(s, null))
  lines.push(...sheriffResultLines(s, ids[0]), ...scapegoatLines(s, ids[0]), ...scapegoatResultLines(s, ids))
  lines.push(...hunterWakeLines(s, ids[0]), ...discussionEndLines, ...voteEndLines)
  for (const team of Object.keys(WIN_LINES) as Winner[]) lines.push(...endLines(team))
  const keys = lines.flatMap(lineParts).filter((p) => !p.startsWith('\u0000')).map(phraseKey)
  return [...new Set(keys)].filter(Boolean)
}
