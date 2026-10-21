import { createGame, nameOf, type Death, type GameState } from './engine'
import { ROLES, type NightRole, type Team } from './roles'

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
  return [`Đêm thứ ${day === 1 ? 'nhất' : day === 4 ? 'tư' : day}.`,'Màn đêm buông xuống. Cả làng hãy nhắm mắt lại.']
}

const WAKE: Record<NightRole, string[]> = {
  SEER: ['Tiên tri hãy thức dậy.', 'Tiên tri hãy cầm điện thoại và chọn một người để soi.'],
  GUARD: ['Bảo vệ hãy thức dậy.', 'Bảo vệ hãy cầm điện thoại và chọn một người để bảo vệ đêm nay.'],
  WEREWOLF: ['Ma Sói hãy thức dậy và nhìn mặt đồng bọn.', 'Ma Sói hãy thống nhất, rồi chọn một người để cắn.'],
  WITCH: ['Phù thủy hãy thức dậy.', 'Phù thủy hãy cầm điện thoại. Bạn có muốn dùng bình cứu hay bình độc không?'],
}

const SLEEP: Record<NightRole, string> = {
  SEER: 'Tiên tri hãy đặt điện thoại xuống và nhắm mắt lại.',
  GUARD: 'Bảo vệ hãy đặt điện thoại xuống và nhắm mắt lại.',
  WEREWOLF: 'Ma Sói hãy đặt điện thoại xuống và nhắm mắt lại.',
  WITCH: 'Phù thủy hãy đặt điện thoại xuống và nhắm mắt lại.',
}

export const wakeLines = (role: NightRole) => WAKE[role]
export const sleepLines = (role: NightRole) => [SLEEP[role]]

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
    const names = deaths.map((d) => deathLabel(s, d.playerId, revealRole))
    lines.push(['Đêm qua, ', ...joinNames(names), ' đã chết.'])
  }
  return lines
}

export function hunterWakeLines(s: GameState, hunterId: string): Line[] {
  return [[nameOf(s, hunterId), ' là Thợ săn.'], 'Thợ săn hãy cầm điện thoại và chọn một người để bắn theo.']
}

export function hunterResultLines(s: GameState, shot: string | null, revealRole: boolean): Line[] {
  if (!shot) return ['Thợ săn đã quyết định không bắn ai.']
  return [['Thợ săn đã bắn chết ', ...deathLabel(s, shot, revealRole), '.']]
}

export function discussionLines(seconds: number): Line[] {
  return [['Bắt đầu thảo luận. Cả làng có ', ...durationParts(seconds), '.']]
}

export const discussionEndLines = ['Hết giờ thảo luận.']

export function voteLines(seconds: number): Line[] {
  return [['Bây giờ cả làng hãy bỏ phiếu. Các bạn có ', ...durationParts(seconds), '.']]
}

export const voteEndLines = ['Hết giờ bỏ phiếu. Hãy chọn người bị treo cổ trên điện thoại.']

export function lastWordsLines(s: GameState, targetId: string, seconds: number): Line[] {
  const name = nameOf(s, targetId)
  return [
    [name, ' bị nhiều phiếu nhất.'],
    [name, ' có ', ...durationParts(seconds), ' để nói lời cuối.'],
  ]
}

export function executionLines(s: GameState, targetId: string | null, revealRole: boolean): Line[] {
  if (!targetId) return ['Hôm nay cả làng không treo cổ ai.']
  return [[...deathLabel(s, targetId, revealRole), ' đã bị cả làng treo cổ.']]
}

export function endLines(winner: Team): string[] {
  return [
    'Trò chơi kết thúc.',
    winner === 'WOLF'
      ? 'Phe Ma Sói chiến thắng. Bóng tối đã bao trùm ngôi làng.'
      : 'Phe Dân Làng chiến thắng. Ngôi làng đã sạch bóng Ma Sói.',
  ]
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
  const s = createGame(roles.map((_, i) => `\u0000${i}`), Object.fromEntries(roles.map((r) => [r, 1])))
  const ids = s.players.map((p) => p.id)
  const deaths = ids.map((playerId) => ({ playerId, cause: 'WOLF' as const }))
  const lines: Line[] = []
  for (let day = 1; day <= MAX_RECORDED_DAY; day++) lines.push(...nightStartLines(day))
  for (const role of Object.keys(WAKE) as NightRole[]) lines.push(...wakeLines(role), ...sleepLines(role))
  for (let seconds = 1; seconds <= MAX_RECORDED_MINUTES * 60; seconds++) {
    lines.push(...discussionLines(seconds), ...voteLines(seconds), ...lastWordsLines(s, ids[0], seconds))
    lines.push(timerWarning(seconds, MAX_RECORDED_MINUTES * 60) ?? '')
  }
  for (const reveal of [false, true]) {
    lines.push(...dawnLines(s, [], reveal), ...dawnLines(s, deaths, reveal), ...hunterResultLines(s, null, reveal))
    lines.push(...executionLines(s, null, reveal))
    for (const id of ids) lines.push(...hunterResultLines(s, id, reveal), ...executionLines(s, id, reveal))
  }
  lines.push(...hunterWakeLines(s, ids[0]), ...discussionEndLines, ...voteEndLines, ...endLines('WOLF'), ...endLines('VILLAGE'))
  const keys = lines.flatMap(lineParts).filter((p) => !p.startsWith('\u0000')).map(phraseKey)
  return [...new Set(keys)].filter(Boolean)
}
