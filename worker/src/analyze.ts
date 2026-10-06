import { z } from 'zod'
import {
  aiAnalysisSchema,
  buildAnalysisResult,
  type AiAnalysis,
  type AnalysisResult,
  type AnalyzeRequest,
  type AnalyzeScanMeta,
} from '@pdf-insight/shared'
import { splitIntoChunks } from './chunking'
import { UpstreamError, type GenerateJson } from './gemini'
import {
  ANALYSIS_SYSTEM_PROMPT,
  MERGE_SYSTEM_PROMPT,
  SCAN_SYSTEM_PROMPT,
  SCAN_USER_MESSAGE,
  buildDocumentMessage,
  buildMergeMessage,
  buildRetryNote,
} from './prompt'

/** ~30–40 tys. tokenów na fragment — mieści się w limicie TPM darmowego planu Gemini. */
export const CHUNK_CHARS = 120_000

/** Brief, sekcja 04: błędna odpowiedź AI → 1 ponowna próba, potem komunikat błędu. */
const MAX_ATTEMPTS = 2

export class AiInvalidResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiInvalidResponseError'
  }
}

/** JSON Schema z tego samego schematu Zod, którym walidujemy odpowiedź — jedno źródło prawdy. */
const { $schema: _ignored, ...responseSchema } = z.toJSONSchema(aiAnalysisSchema)

async function generateValidated(
  generate: GenerateJson,
  system: string,
  user: string,
  pdfBase64?: string,
): Promise<AiAnalysis> {
  let problem: string | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_ATTEMPTS
    const prompt = problem ? user + buildRetryNote(problem) : user

    let raw: string
    try {
      raw = await generate({ system, user: prompt, responseSchema, pdfBase64 })
    } catch (error) {
      if (error instanceof UpstreamError && error.retryable && !isLastAttempt) continue
      throw error
    }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      problem = 'the response was not valid JSON.'
      continue
    }

    const result = aiAnalysisSchema.safeParse(json)
    if (result.success) return result.data
    problem = `schema validation failed:\n${z.prettifyError(result.error).slice(0, 1500)}`
  }

  throw new AiInvalidResponseError(problem ?? 'AI response invalid')
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item).trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Listy faktów (podmioty, kwoty, daty) łączymy deterministycznie z wyników fragmentów,
 * zamiast prosić model o ich przepisanie — model przy scalaniu potrafi gubić pozycje.
 */
export function mergeFacts(
  partials: AiAnalysis[],
): Pick<AiAnalysis, 'entities' | 'amounts' | 'dates'> {
  return {
    entities: {
      organizations: uniqueBy(
        partials.flatMap((p) => p.entities.organizations),
        (name) => name,
      ),
      people: uniqueBy(
        partials.flatMap((p) => p.entities.people),
        (name) => name,
      ),
    },
    amounts: uniqueBy(
      partials.flatMap((p) => p.amounts),
      (a) => `${a.value}|${a.currency}|${a.context}`,
    ),
    dates: uniqueBy(
      partials.flatMap((p) => p.dates),
      (d) => `${d.date}|${d.context}`,
    ),
  }
}

export async function analyzeDocument(
  request: AnalyzeRequest,
  generate: GenerateJson,
): Promise<AnalysisResult> {
  const chunks = splitIntoChunks(request.text, CHUNK_CHARS)
  const file = { fileName: request.fileName, pages: request.pages }

  if (chunks.length <= 1) {
    const ai = await generateValidated(
      generate,
      ANALYSIS_SYSTEM_PROMPT,
      buildDocumentMessage(request.text),
    )
    return buildAnalysisResult(ai, file)
  }

  // Długie dokumenty (brief F-08): map — każdy fragment osobno, reduce — scalenie.
  const partials = await Promise.all(
    chunks.map((chunk, i) =>
      generateValidated(
        generate,
        ANALYSIS_SYSTEM_PROMPT,
        buildDocumentMessage(chunk, { index: i + 1, total: chunks.length }),
      ),
    ),
  )
  const merged = await generateValidated(generate, MERGE_SYSTEM_PROMPT, buildMergeMessage(partials))
  return buildAnalysisResult({ ...merged, ...mergeFacts(partials) }, file)
}

/**
 * Skan bez warstwy tekstowej (brief F-10): Gemini dostaje sam plik PDF i odczytuje go wizualnie.
 * Bez dzielenia na fragmenty — liczbę stron ogranicza `LIMITS.maxScanPages`.
 */
export async function analyzeScan(
  meta: AnalyzeScanMeta,
  pdfBase64: string,
  generate: GenerateJson,
): Promise<AnalysisResult> {
  const ai = await generateValidated(generate, SCAN_SYSTEM_PROMPT, SCAN_USER_MESSAGE, pdfBase64)
  return buildAnalysisResult(ai, meta)
}
