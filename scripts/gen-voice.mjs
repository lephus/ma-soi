// Records every fixed narrator phrase with Edge TTS into public/voice/<voice>/ and writes
// src/tts/clips.json. Only new phrases are recorded; clips no longer used are deleted.
//
//   npm run gen-voice

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { runnerImport } from 'vite'
import { VOICES, synthesize } from './edge-tts.mjs'

const CONCURRENCY = 6

const root = new URL('../', import.meta.url).pathname
const { module: script } = await runnerImport(`${root}src/game/script.ts`)

const phrases = script.allPhrases()
const fileOf = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12)

for (const id of Object.keys(VOICES)) {
  const dir = `${root}public/voice/${id}`
  await mkdir(dir, { recursive: true })
  const wanted = new Set(phrases.map((p) => `${fileOf(p)}.mp3`))
  for (const f of await readdir(dir)) if (!wanted.has(f)) await rm(`${dir}/${f}`)

  const todo = phrases.filter((p) => !existsSync(`${dir}/${fileOf(p)}.mp3`))
  let done = 0
  const worker = async () => {
    for (let p; (p = todo.shift()) !== undefined; ) {
      await synthesize(id, p, `${dir}/${fileOf(p)}.mp3`)
      process.stdout.write(`\r${id}: ${++done} clip mới`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`\r${id}: ${phrases.length} clip (${done} mới)`)
}

const files = Object.fromEntries([...phrases].sort().map((p) => [p, fileOf(p)]))
await writeFile(`${root}src/tts/clips.json`, `${JSON.stringify({ files }, null, 2)}\n`)
console.log(`Đã ghi src/tts/clips.json (${phrases.length} câu)`)
