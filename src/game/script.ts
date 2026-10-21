import { nameOf, type Death, type GameState } from './engine'
import { ROLES, type NightRole, type Team } from './roles'

/** What the narrator says. Nothing secret (seer results, who was bitten) is ever spoken. */

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} giây`
  return s === 0 ? `${m} phút` : `${m} phút ${s} giây`
}

export function nightStartLines(day: number): string[] {
  return [`Đêm thứ ${day}.`, 'Màn đêm buông xuống. Cả làng hãy nhắm mắt lại.']
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

function deathLabel(s: GameState, playerId: string, revealRole: boolean): string {
  const p = s.players.find((x) => x.id === playerId)
  if (!p) return 'Không rõ'
  return revealRole ? `${p.name}, vai ${ROLES[p.role].nameVi}` : p.name
}

export function dawnLines(s: GameState, deaths: Death[], revealRole: boolean): string[] {
  const lines = ['Trời đã sáng. Cả làng hãy mở mắt.']
  if (deaths.length === 0) {
    lines.push('Đêm qua là một đêm bình yên. Không có ai chết.')
  } else {
    const names = deaths.map((d) => deathLabel(s, d.playerId, revealRole))
    lines.push(`Đêm qua, ${joinNames(names)} đã chết.`)
  }
  return lines
}

export function hunterWakeLines(s: GameState, hunterId: string): string[] {
  return [`${nameOf(s, hunterId)} là Thợ săn.`, 'Thợ săn hãy cầm điện thoại và chọn một người để bắn theo.']
}

export function hunterResultLines(s: GameState, shot: string | null, revealRole: boolean): string[] {
  if (!shot) return ['Thợ săn đã quyết định không bắn ai.']
  return [`Thợ săn đã bắn chết ${deathLabel(s, shot, revealRole)}.`]
}

export function discussionLines(seconds: number): string[] {
  return [`Bắt đầu thảo luận. Cả làng có ${formatDuration(seconds)}.`]
}

export const discussionEndLines = ['Hết giờ thảo luận.']

export function voteLines(seconds: number): string[] {
  return [`Bây giờ cả làng hãy bỏ phiếu. Các bạn có ${formatDuration(seconds)}.`]
}

export const voteEndLines = ['Hết giờ bỏ phiếu. Hãy chọn người bị treo cổ trên điện thoại.']

export function lastWordsLines(s: GameState, targetId: string, seconds: number): string[] {
  return [`${nameOf(s, targetId)} bị nhiều phiếu nhất.`, `${nameOf(s, targetId)} có ${formatDuration(seconds)} để nói lời cuối.`]
}

export function executionLines(s: GameState, targetId: string | null, revealRole: boolean): string[] {
  if (!targetId) return ['Hôm nay cả làng không treo cổ ai.']
  return [`${deathLabel(s, targetId, revealRole)} đã bị cả làng treo cổ.`]
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

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} và ${names[names.length - 1]}`
}
