import { z } from 'zod'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const REQUEST_TIMEOUT_MS = 25_000

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

export function createGeminiClient(options: {
  apiKey: string
  model: string
  fetchFn?: typeof fetch
}): GenerateJson {
  const { apiKey, model, fetchFn = fetch } = options
  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`

  return async ({ system, user, responseSchema }) => {
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
            // Ekstrakcja nie wymaga „myślenia” — wyłączenie skraca czas odpowiedzi (cel: < 30 s).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      })
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      throw new UpstreamError(timedOut ? 'Gemini timeout' : 'Gemini network error', 504, true)
    }

    if (!response.ok) {
      // Treść błędu dostawcy logujemy tylko po stronie serwera, nie przekazujemy klientowi.
      const detail = (await response.text()).slice(0, 500)
      console.error(`Gemini HTTP ${response.status}: ${detail}`)
      const retryable = response.status === 429 || response.status >= 500
      throw new UpstreamError(`Gemini HTTP ${response.status}`, response.status, retryable)
    }

    const parsed = geminiResponseSchema.safeParse(await response.json())
    if (!parsed.success) throw new UpstreamError('Unexpected Gemini response shape', 502, true)

    const { candidates, promptFeedback } = parsed.data
    if (promptFeedback?.blockReason) {
      throw new UpstreamError(`Prompt blocked: ${promptFeedback.blockReason}`, 422, false)
    }
    const candidate = candidates?.[0]
    const text = candidate?.content?.parts.map((part) => part.text ?? '').join('') ?? ''
    if (!text) {
      throw new UpstreamError(`Empty response (${candidate?.finishReason ?? 'unknown'})`, 502, true)
    }
    return text
  }
}
