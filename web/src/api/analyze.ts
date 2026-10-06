import { z } from 'zod'
import {
  analysisResultSchema,
  type AnalysisResult,
  type AnalyzeErrorCode,
  type AnalyzeRequest,
  type AnalyzeScanMeta,
} from '@pdf-insight/shared'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 90_000

export type ClientErrorCode = AnalyzeErrorCode | 'NETWORK' | 'TIMEOUT' | 'CONFIG'

export class AnalyzeError extends Error {
  readonly code: ClientErrorCode

  constructor(message: string, code: ClientErrorCode) {
    super(message)
    this.name = 'AnalyzeError'
    this.code = code
  }
}

const errorBodySchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
})
const successBodySchema = z.object({ ok: z.literal(true), result: z.unknown() })

const KNOWN_CODES: readonly AnalyzeErrorCode[] = [
  'BAD_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'AI_INVALID_RESPONSE',
  'AI_UNAVAILABLE',
  'INTERNAL',
]

export function analyzeText(request: AnalyzeRequest): Promise<AnalysisResult> {
  return postAnalysis('/api/analyze', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

/** F-10: skan bez warstwy tekstowej — wysyłamy sam plik, Gemini rozpoznaje tekst (OCR). */
export function analyzeScan(file: File, meta: AnalyzeScanMeta): Promise<AnalysisResult> {
  const query = new URLSearchParams({ fileName: meta.fileName, pages: String(meta.pages) })
  return postAnalysis(`/api/analyze-scan?${query}`, {
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  })
}

async function postAnalysis(
  path: string,
  init: { headers: Record<string, string>; body: BodyInit },
): Promise<AnalysisResult> {
  if (!API_URL) throw new AnalyzeError('Brak konfiguracji adresu API (VITE_API_URL).', 'CONFIG')

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AnalyzeError('Analiza trwała zbyt długo. Spróbuj ponownie.', 'TIMEOUT')
    }
    throw new AnalyzeError('Brak połączenia z serwerem analizy. Sprawdź internet.', 'NETWORK')
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const parsed = errorBodySchema.safeParse(body)
    const code = KNOWN_CODES.find((known) => known === parsed.data?.error.code) ?? 'INTERNAL'
    throw new AnalyzeError(
      parsed.data?.error.message ?? `Serwer zwrócił błąd (${response.status}).`,
      code,
    )
  }

  // Brief F-04: wynik walidowany przed wyświetleniem — nie ufamy nawet własnemu backendowi.
  const success = successBodySchema.safeParse(body)
  const result = analysisResultSchema.safeParse(success.data?.result)
  if (!result.success) {
    throw new AnalyzeError(
      'Otrzymany wynik ma niepoprawny format. Spróbuj ponownie.',
      'AI_INVALID_RESPONSE',
    )
  }
  return result.data
}
