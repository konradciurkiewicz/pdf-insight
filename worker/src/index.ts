import { analyzeRequestSchema, LIMITS } from '@pdf-insight/shared'
import { AiInvalidResponseError, analyzeDocument } from './analyze'
import { createGeminiClient, parseModelList, UpstreamError } from './gemini'
import { corsHeaders, errorResponse, jsonResponse, parseAllowedOrigins } from './http'

/** Sekret ustawiany przez `wrangler secret put` — nie występuje w wrangler.jsonc, więc nie ma go w typach. */
export interface WorkerEnv extends Env {
  GEMINI_API_KEY: string
}

/** Tekst w UTF-8 to maks. 4 bajty na znak + narzut JSON. Ucinamy zbyt duże żądania przed parsowaniem. */
const MAX_BODY_BYTES = LIMITS.maxTextChars * 4 + 10_000

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS)
    const cors = corsHeaders(origin, allowedOrigins)

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ ok: true }, 200, cors)
    }
    if (url.pathname !== '/api/analyze') {
      return errorResponse('BAD_REQUEST', 'Nie znaleziono.', 404, cors)
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: cors['Access-Control-Allow-Origin'] ? 204 : 403,
        headers: cors,
      })
    }
    if (request.method !== 'POST') {
      return errorResponse('BAD_REQUEST', 'Metoda niedozwolona.', 405, cors)
    }
    // CORS nie chroni przed wywołaniami spoza przeglądarki, ale odrzucamy obce originy przed zużyciem limitu AI.
    if (!origin || !allowedOrigins.has(origin)) {
      return errorResponse('BAD_REQUEST', 'Niedozwolone źródło żądania.', 403, cors)
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const [perIp, global] = await Promise.all([
      env.IP_LIMITER.limit({ key: ip }),
      env.GLOBAL_LIMITER.limit({ key: 'global' }),
    ])
    if (!perIp.success || !global.success) {
      return errorResponse(
        'RATE_LIMITED',
        'Zbyt wiele żądań. Odczekaj minutę i spróbuj ponownie.',
        429,
        cors,
      )
    }

    const declaredLength = Number(request.headers.get('Content-Length') ?? '0')
    if (declaredLength > MAX_BODY_BYTES) {
      return errorResponse('PAYLOAD_TOO_LARGE', 'Dokument jest zbyt duży do analizy.', 413, cors)
    }
    const rawBody = await request.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return errorResponse('PAYLOAD_TOO_LARGE', 'Dokument jest zbyt duży do analizy.', 413, cors)
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse('BAD_REQUEST', 'Nieprawidłowy format żądania.', 400, cors)
    }
    const parsed = analyzeRequestSchema.safeParse(body)
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some((issue) => issue.code === 'too_big')
      return tooLong
        ? errorResponse('PAYLOAD_TOO_LARGE', 'Dokument zawiera zbyt dużo tekstu.', 413, cors)
        : errorResponse('BAD_REQUEST', 'Nieprawidłowe dane dokumentu.', 400, cors)
    }

    const generate = createGeminiClient({
      apiKey: env.GEMINI_API_KEY,
      models: parseModelList(env.GEMINI_MODELS),
    })
    try {
      const result = await analyzeDocument(parsed.data, generate)
      return jsonResponse({ ok: true, result }, 200, cors)
    } catch (error) {
      if (error instanceof AiInvalidResponseError) {
        console.error(`AI invalid response: ${error.message}`)
        return errorResponse(
          'AI_INVALID_RESPONSE',
          'Model AI zwrócił niepoprawną odpowiedź. Spróbuj ponownie.',
          502,
          cors,
        )
      }
      if (error instanceof UpstreamError) {
        console.error(`Upstream error: ${error.message}`)
        const message =
          error.status === 429
            ? 'Wyczerpano chwilowy limit usługi AI. Spróbuj za minutę.'
            : 'Usługa AI jest chwilowo niedostępna. Spróbuj ponownie.'
        return errorResponse('AI_UNAVAILABLE', message, 503, cors)
      }
      console.error('Unexpected error', error instanceof Error ? error.message : error)
      return errorResponse('INTERNAL', 'Wystąpił nieoczekiwany błąd serwera.', 500, cors)
    }
  },
} satisfies ExportedHandler<WorkerEnv>
