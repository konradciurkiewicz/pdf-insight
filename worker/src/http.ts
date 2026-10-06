import type { AnalyzeErrorCode, AnalyzeResponse } from '@pdf-insight/shared'

export function parseAllowedOrigins(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  )
}

/** Nagłówki CORS tylko dla dozwolonego originu — dla pozostałych brak nagłówków = blokada w przeglądarce. */
export function corsHeaders(origin: string | null, allowed: Set<string>): Record<string, string> {
  if (!origin || !allowed.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-Pages',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function jsonResponse(
  body: AnalyzeResponse | { ok: true },
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...cors } })
}

export function errorResponse(
  code: AnalyzeErrorCode,
  message: string,
  status: number,
  cors: Record<string, string>,
): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status, cors)
}
