// Shared Edge TTS helpers for `npm run gen-voice` and the dev server's /api/tts endpoint.
// Uses the Python `edge-tts` CLI, or `uvx` to run it without installing.

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename } from 'node:fs/promises'
import { promisify } from 'node:util'

export const VOICES = { HoaiMy: 'vi-VN-HoaiMyNeural', NamMinh: 'vi-VN-NamMinhNeural' }

/** Longest text /api/tts accepts; it only reads player names. */
export const MAX_NAME_LENGTH = 40

const run = promisify(execFile)
let cli

export async function synthesize(voiceId, text, out) {
  cli ??= (async () => run('edge-tts', ['--version']))().then(
    () => ['edge-tts'],
    () => ['uvx', 'edge-tts'],
  )
  const [cmd, ...pre] = await cli
  // Written next to the target and renamed, so a half-written file is never served.
  const tmp = `${out}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
  for (let attempt = 1; ; attempt++) {
    try {
      // `--text=` keeps a name starting with "-" from being read as an option.
      await run(cmd, [...pre, '--voice', VOICES[voiceId], `--text=${text}`, '--write-media', tmp])
      await rename(tmp, out)
      return
    } catch (e) {
      if (attempt >= 3) throw new Error(`"${text}": ${e.stderr || e.message}`)
    }
  }
}

/** Connect middleware for GET /api/tts?voice=HoaiMy&text=An, caching results in `cacheDir`. */
export function ttsMiddleware(cacheDir) {
  return async (req, res) => {
    const q = new URL(req.url ?? '', 'http://x').searchParams
    const voice = q.get('voice') ?? ''
    const text = (q.get('text') ?? '').trim()
    if (!(voice in VOICES) || !text || text.length > MAX_NAME_LENGTH) {
      res.statusCode = 400
      return res.end('bad request')
    }
    try {
      await mkdir(cacheDir, { recursive: true })
      const file = `${cacheDir}/${voice}-${createHash('sha1').update(text).digest('hex')}.mp3`
      if (!existsSync(file)) await synthesize(voice, text, file)
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.end(await readFile(file))
    } catch (e) {
      res.statusCode = 502
      res.end(String(e))
    }
  }
}
