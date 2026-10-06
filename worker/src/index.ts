import {
  analyzeRequestSchema,
  analyzeScanMetaSchema,
  LIMITS,
  type AnalysisResult,
  type AnalyzeErrorCode,
} from '@pdf-insight/shared'
import { AiInvalidResponseError, analyzeDocument, analyzeScan } from './analyze'
import { createGeminiClient, parseModelList, UpstreamError, type GenerateJson } from './gemini'
import { corsHeaders, errorResponse, jsonResponse, parseAllowedOrigins } from './http'

/** Sekret ustawiany przez `wrangler secret put` — nie występuje w wrangler.jsonc, więc nie ma go w typach. */
export interface WorkerEnv extends Env {
  GEMINI_API_KEY: string
}

/** Tekst w UTF-8 to maks. 4 bajty na znak + narzut JSON. Ucinamy zbyt duże żądania przed parsowaniem. */
const MAX_TEXT_BODY_BYTES = LIMITS.maxTextChars * 4 + 10_000

const ROUTES = new Set(['/api/analyze', '/api/analyze-scan'])

/** Błąd żądania z gotowym komunikatem dla użytkownika. */
class RequestError extends Error {
  constructor(
    readonly code: AnalyzeErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

function tooLarge(message = 'Dokument jest zbyt duży do analizy.') {
  return new RequestError('PAYLOAD_TOO_LARGE', message, 413)
}

/** Odrzuca żądanie po nagłówku Content-Length, zanim wczytamy body. */
function assertDeclaredLength(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > maxBytes) throw tooLarge()
}

async function handleText(request: Request, generate: GenerateJson): Promise<AnalysisResult> {
  assertDeclaredLength(request, MAX_TEXT_BODY_BYTES)
  const rawBody = await request.text()
  if (rawBody.length > MAX_TEXT_BODY_BYTES) throw tooLarge()

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new RequestError('BAD_REQUEST', 'Nieprawidłowy format żądania.', 400)
  }
  const parsed = analyzeRequestSchema.safeParse(body)
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((issue) => issue.code === 'too_big')
    throw tooLong
      ? tooLarge('Dokument zawiera zbyt dużo tekstu.')
      : new RequestError('BAD_REQUEST', 'Nieprawidłowe dane dokumentu.', 400)
  }
  return analyzeDocument(parsed.data, generate)
}

/** F-10: skan bez warstwy tekstowej — surowe bajty PDF w body, metadane w query string. */
async function handleScan(
  request: Request,
  url: URL,
  generate: GenerateJson,
): Promise<AnalysisResult> {
  const meta = analyzeScanMetaSchema.safeParse({
    fileName: url.searchParams.get('fileName'),
    pages: url.searchParams.get('pages'),
  })
  if (!meta.success) {
    const tooManyPages = meta.error.issues.some((issue) => issue.path[0] === 'pages')
    throw tooManyPages
      ? tooLarge(`Skan może mieć maksymalnie ${LIMITS.maxScanPages} stron.`)
      : new RequestError('BAD_REQUEST', 'Nieprawidłowe dane dokumentu.', 400)
  }
  if (request.headers.get('Content-Type') !== 'application/pdf') {
    throw new RequestError('BAD_REQUEST', 'Oczekiwano pliku PDF.', 400)
  }

  assertDeclaredLength(request, LIMITS.maxFileBytes)
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > LIMITS.maxFileBytes) throw tooLarge()
  // Ta sama kontrola sygnatury co we frontendzie — nie ufamy klientowi.
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) {
    throw new RequestError('BAD_REQUEST', 'Plik nie jest poprawnym dokumentem PDF.', 400)
  }

  return analyzeScan(meta.data, bytes.toBase64(), generate)
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS)
    const cors = corsHeaders(origin, allowedOrigins)

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ ok: true }, 200, cors)
    }
    if (!ROUTES.has(url.pathname)) {
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

    const generate = createGeminiClient({
      apiKey: env.GEMINI_API_KEY,
      models: parseModelList(env.GEMINI_MODELS),
    })
    try {
      const result =
        url.pathname === '/api/analyze-scan'
          ? await handleScan(request, url, generate)
          : await handleText(request, generate)
      return jsonResponse({ ok: true, result }, 200, cors)
    } catch (error) {
      if (error instanceof RequestError) {
        return errorResponse(error.code, error.message, error.status, cors)
      }
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
