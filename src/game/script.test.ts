import { describe, expect, it } from 'vitest'
import clips from '../tts/clips.json'
import { createGame } from './engine'
import { allPhrases, dawnLines, lastWordsLines, lineText } from './script'

describe('script', () => {
  it('has a recorded clip for every fixed phrase (run `npm run gen-voice` after changing wording)', () => {
    const missing = allPhrases().filter((p) => !(p in clips.files))
    expect(missing).toEqual([])
  })

  it('joins split lines back into readable captions', () => {
    const s = createGame(['An', 'Bình', 'Chi', 'Dũng'], { WEREWOLF: 1 })
    const deaths = ['p0', 'p1', 'p2'].map((playerId) => ({ playerId, cause: 'WOLF' as const }))
    expect(lineText(dawnLines(s, deaths, false)[1])).toBe('Đêm qua, An, Bình và Chi đã chết.')
    expect(lastWordsLines(s, 'p3', 90).map(lineText)).toEqual(['Dũng bị nhiều phiếu nhất.', 'Dũng có 1 phút 30 giây để nói lời cuối.'])
  })
})
