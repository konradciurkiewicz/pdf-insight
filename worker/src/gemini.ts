import { z } from 'zod'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Na model — przy przeciążeniu lepiej szybko przejść na kolejny, niż czekać. */
const REQUEST_TIMEOUT_MS = 20_000
/** OCR skanu trwa dłużej niż analiza samego tekstu. */
const PDF_REQUEST_TIMEOUT_MS = 40_000
/** Znacznik podmieniany na base64 PDF już po JSON.stringify — patrz `buildRequestBody`. */
const PDF_PLACEHOLDER = '__PDF_BASE64__'

/** Błąd po stronie dostawcy AI (sieć, limit, 5xx). `retryable` = warto spróbować ponownie. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

export interface GenerateJsonRequest {
  system: string
  user: string
  /** JSON Schema odpowiedzi — Gemini wymusza strukturę po swojej stronie (structured output). */
  responseSchema: Record<string, unknown>
  /** Plik PDF (base64) dla skanów — Gemini odczytuje go sam (OCR). */
  pdfBase64?: string
}

/**
 * Ciało żądania do Gemini. Base64 skanu (do ~13 MB) wstawiamy po serializacji zamiast przepuszczać
 * przez JSON.stringify — oszczędzamy czas CPU (darmowy plan Workers: ~10 ms CPU na żądanie).
 * Bezpieczne, bo `pdfBase64` tworzy worker (`Uint8Array.toBase64`), a alfabet base64 nie zawiera
 * znaków wymagających escapowania w JSON.
 */
export function buildRequestBody(model: string, request: GenerateJsonRequest): string {
  const { system, user, responseSchema, pdfBase64 } = request
  const parts: Record<string, unknown>[] = [{ text: user }]
  if (pdfBase64)
    parts.unshift({ inlineData: { mimeType: 'application/pdf', data: PDF_PLACEHOLDER } })

  const json = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseJsonSchema: responseSchema,
      thinkingConfig: thinkingConfigFor(model),
    },
  })
  if (!pdfBase64) return json
  // Funkcja jako drugi argument — `$` w danych nie jest interpretowane jako wzorzec zamiany.
  return json.replace(`"${PDF_PLACEHOLDER}"`, () => `"${pdfBase64}"`)
}

/** Abstrakcja nad modelem — pozwala testować logikę analizy bez sieci. */
export type GenerateJson = (request: GenerateJsonRequest) => Promise<string>

/** Tylko pola, których używamy. Odpowiedź z zewnątrz też walidujemy, zamiast ufać typom. */
const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }).optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
})

/**
 * Gemini 2.x wyłącza „myślenie” przez `thinkingBudget: 0`; Gemini 3.x odrzuca ten parametr
 * i wymaga `thinkingLevel`. Ekstrakcja nie potrzebuje rozumowania — minimum skraca czas odpowiedzi.
 */
export function thinkingConfigFor(model: string): Record<string, unknown> {
  return /^gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' }
}

export function parseModelList(value: string): string[] {
  return value
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
}

/**
 * Klient z łańcuchem modeli: przy przeciążeniu (429/503) lub timeoucie próbujemy kolejnego modelu.
 * Darmowy plan Gemini regularnie zwraca 503 „high demand” — pojedynczy model to za mało na demo.
 */
export function createGeminiClient(options: {
  apiKey: string
  models: string[]
  fetchFn?: typeof fetch
}): GenerateJson {
  const { apiKey, models, fetchFn = fetch } = options
  if (models.length === 0) throw new Error('No Gemini models configured')

  return async (request) => {
    let lastError: UpstreamError | null = null
    for (const model of models) {
      try {
        return await callModel(model, request)
      } catch (error) {
        if (!(error instanceof UpstreamError) || !error.retryable) throw error
        lastError = error
      }
    }
    throw lastError ?? new UpstreamError('All models failed', 503, true)
  }

  async function callModel(model: string, request: GenerateJsonRequest): Promise<string> {
    const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`
    let response: Response
    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(
          request.pdfBase64 ? PDF_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
        ),
        body: buildRequestBody(model, request),
      })
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      throw new UpstreamError(`${model}: ${timedOut ? 'timeout' : 'network error'}`, 504, true)
    }

    if (!response.ok) {
      // Treść błędu dostawcy logujemy tylko po stronie serwera, nie przekazujemy klientowi.
      const detail = (await response.text()).slice(0, 300)
      console.error(`Gemini ${model} HTTP ${response.status}: ${detail}`)
      const retryable = response.status === 429 || response.status >= 500
      throw new UpstreamError(`${model}: HTTP ${response.status}`, response.status, retryable)
    }

    const parsed = geminiResponseSchema.safeParse(await response.json())
    if (!parsed.success) throw new UpstreamError(`${model}: unexpected response shape`, 502, true)

    const { candidates, promptFeedback } = parsed.data
    if (promptFeedback?.blockReason) {
      throw new UpstreamError(`Prompt blocked: ${promptFeedback.blockReason}`, 422, false)
    }
    const candidate = candidates?.[0]
    const text = candidate?.content?.parts.map((part) => part.text ?? '').join('') ?? ''
    if (!text) {
      const reason = candidate?.finishReason ?? 'unknown'
      throw new UpstreamError(`${model}: empty response (${reason})`, 502, true)
    }
    return text
  }
}
