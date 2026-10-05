import { z } from 'zod'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Na model — przy przeciążeniu lepiej szybko przejść na kolejny, niż czekać. */
const REQUEST_TIMEOUT_MS = 20_000

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

  async function callModel(
    model: string,
    { system, user, responseSchema }: GenerateJsonRequest,
  ): Promise<string> {
    const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`
    let response: Response
    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
            thinkingConfig: thinkingConfigFor(model),
          },
        }),
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
