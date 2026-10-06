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
  /** Maks. liczba stron skanu wysyłanego do OCR — więcej stron = dłużej niż ~30 s i większe zużycie limitu. */
  maxScanPages: 20,
} as const

/** Ciało żądania POST /api/analyze. */
export const analyzeRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  pages: z.number().int().positive().max(10_000),
  text: z.string().min(LIMITS.minTextChars).max(LIMITS.maxTextChars),
})

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>

/**
 * POST /api/analyze-scan — skan bez warstwy tekstowej (F-10, OCR przez Gemini).
 * Ciało żądania to surowe bajty PDF (`application/pdf`); metadane w query string.
 */
export const analyzeScanMetaSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  pages: z.coerce.number().int().positive().max(LIMITS.maxScanPages),
})

export type AnalyzeScanMeta = z.infer<typeof analyzeScanMetaSchema>

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
