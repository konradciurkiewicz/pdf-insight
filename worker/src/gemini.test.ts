import { describe, expect, it, vi } from 'vitest'
import { createGeminiClient, parseModelList, thinkingConfigFor, UpstreamError } from './gemini'

const request = { system: 'sys', user: 'doc', responseSchema: { type: 'object' } }

function geminiOk(text: string): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] })
}

function modelOf(input: RequestInfo | URL): string {
  return String(input).match(/models\/([^:]+):/)?.[1] ?? ''
}

describe('createGeminiClient — łańcuch modeli', () => {
  it('przy przeciążeniu (503) przechodzi na kolejny model', async () => {
    const fetchFn = vi.fn<typeof fetch>(async (input) =>
      modelOf(input) === 'model-a' ? new Response('high demand', { status: 503 }) : geminiOk('{}'),
    )
    const generate = createGeminiClient({ apiKey: 'k', models: ['model-a', 'model-b'], fetchFn })

    await expect(generate(request)).resolves.toBe('{}')
    expect(fetchFn.mock.calls.map(([input]) => modelOf(input))).toEqual(['model-a', 'model-b'])
  })

  it('nie przechodzi dalej przy błędzie trwałym (400) — to błąd konfiguracji, nie przeciążenie', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('bad', { status: 400 }))
    const generate = createGeminiClient({ apiKey: 'k', models: ['model-a', 'model-b'], fetchFn })

    await expect(generate(request)).rejects.toMatchObject({ status: 400, retryable: false })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('gdy wszystkie modele są przeciążone, zgłasza błąd do ponowienia', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('busy', { status: 429 }))
    const generate = createGeminiClient({ apiKey: 'k', models: ['a', 'b', 'c'], fetchFn })

    const error = await generate(request).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(UpstreamError)
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('klucz API idzie w nagłówku, nie w URL (nie trafia do logów z adresami)', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => geminiOk('{}'))
    await createGeminiClient({ apiKey: 'secret-key', models: ['m'], fetchFn })(request)

    const [input, init] = fetchFn.mock.calls[0] ?? []
    expect(String(input)).not.toContain('secret-key')
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('secret-key')
  })
})

describe('konfiguracja modeli', () => {
  it('dobiera parametr „thinking” do generacji modelu', () => {
    expect(thinkingConfigFor('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 })
    expect(thinkingConfigFor('gemini-3.5-flash')).toEqual({ thinkingLevel: 'minimal' })
  })

  it('parsuje listę modeli z konfiguracji', () => {
    expect(parseModelList(' gemini-3.5-flash, gemini-2.5-flash ,,')).toEqual([
      'gemini-3.5-flash',
      'gemini-2.5-flash',
    ])
  })
})
