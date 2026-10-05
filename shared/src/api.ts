import { z } from 'zod'
import type { AnalysisResult } from './schema'

/** Limity wspólne dla frontendu i workera — jedno miejsce prawdy. */
export const LIMITS = {
  /** Maksymalny rozmiar pliku PDF (brief F-01). */
  maxFileBytes: 10 * 1024 * 1024,
  /** Maksymalna długość tekstu wysyłanego do analizy (znaki). */
  maxTextChars: 400_000,
  /** Minimalna długość tekstu — poniżej traktujemy PDF jako skan bez warstwy tekstowej. */
  minTextChars: 50,
} as const

/** Ciało żądania POST /api/analyze. */
export const analyzeRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  pages: z.number().int().positive().max(10_000),
  text: z.string().min(LIMITS.minTextChars).max(LIMITS.maxTextChars),
})

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>

export type AnalyzeErrorCode =
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL'

export type AnalyzeResponse =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: { code: AnalyzeErrorCode; message: string } }
