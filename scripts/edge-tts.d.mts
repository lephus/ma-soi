import type { Connect } from 'vite'

export declare const VOICES: Record<string, string>
export declare const MAX_NAME_LENGTH: number
export declare function synthesize(voiceId: string, text: string, out: string): Promise<void>
export declare function ttsMiddleware(cacheDir: string): Connect.NextHandleFunction
