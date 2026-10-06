import { describe, expect, it } from 'vitest'
import {
  aiAnalysisSchema,
  analysisResultSchema,
  buildAnalysisResult,
  type AiAnalysis,
  type AnalysisResult,
} from './schema'
import { analyzeRequestSchema, analyzeScanMetaSchema } from './api'

/** Przykład dosłownie z briefu (sekcja 04), uzupełniony do 3 keyPoints. */
const briefExample: AnalysisResult = {
  document: {
    fileName: 'umowa.pdf',
    pages: 4,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa serwisowa',
    date: '2026-09-01',
  },
  summary: 'Umowa określa zasady świadczenia usług serwisowych. Obowiązuje przez 12 miesięcy.',
  keyPoints: ['Okres umowy 12 mies.', 'Wynagrodzenie 12 500 PLN', 'Termin płatności 1.10.2026'],
  entities: { organizations: ['Przykład sp. z o.o.'], people: [] },
  amounts: [{ value: 12500.0, currency: 'PLN', context: 'wynagrodzenie' }],
  dates: [{ date: '2026-10-01', context: 'termin płatności' }],
  keywords: ['serwis', 'SLA'],
}

function withChange(patch: (draft: AnalysisResult) => void): unknown {
  const draft: AnalysisResult = JSON.parse(JSON.stringify(briefExample))
  patch(draft)
  return draft
}

describe('analysisResultSchema', () => {
  it('akceptuje przykład z briefu', () => {
    expect(analysisResultSchema.safeParse(briefExample).success).toBe(true)
  })

  it('akceptuje brak informacji jako null i puste tablice', () => {
    const result = withChange((d) => {
      d.document.title = null
      d.document.date = null
      d.entities = { organizations: [], people: [] }
      d.amounts = []
      d.dates = []
      d.keywords = []
    })
    expect(analysisResultSchema.safeParse(result).success).toBe(true)
  })

  it('zwraca klucze document w kolejności z briefu', () => {
    const parsed = analysisResultSchema.parse(briefExample)
    expect(Object.keys(parsed.document)).toEqual([
      'fileName',
      'pages',
      'language',
      'type',
      'title',
      'date',
    ])
  })

  it.each([
    ['data w formacie polskim', (d: AnalysisResult) => (d.document.date = '01.09.2026')],
    [
      'nieistniejąca data',
      (d: AnalysisResult) => (d.dates = [{ date: '2026-02-30', context: 'termin' }]),
    ],
    [
      'waluta jako symbol',
      (d: AnalysisResult) => (d.amounts = [{ value: 1, currency: 'zł', context: 'cena' }]),
    ],
    [
      'waluta małymi literami',
      (d: AnalysisResult) => (d.amounts = [{ value: 1, currency: 'pln', context: 'cena' }]),
    ],
    ['język jako nazwa', (d: AnalysisResult) => (d.document.language = 'polski')],
    ['nieznany typ dokumentu', (d: AnalysisResult) => ((d.document.type as string) = 'list')],
    ['za mało keyPoints', (d: AnalysisResult) => (d.keyPoints = ['a', 'b'])],
    ['za dużo keyPoints', (d: AnalysisResult) => (d.keyPoints = Array(8).fill('punkt'))],
    ['pusty summary', (d: AnalysisResult) => (d.summary = '   ')],
    [
      'kwota jako tekst',
      (d: AnalysisResult) =>
        ((d.amounts as unknown) = [{ value: '12 500', currency: 'PLN', context: 'cena' }]),
    ],
    ['ułamkowa liczba stron', (d: AnalysisResult) => (d.document.pages = 1.5)],
  ])('odrzuca: %s', (_label, patch) => {
    expect(analysisResultSchema.safeParse(withChange(patch)).success).toBe(false)
  })

  it('odrzuca brak wymaganego pola (pól nie można usuwać)', () => {
    const { keywords: _removed, ...withoutKeywords } = briefExample
    expect(analysisResultSchema.safeParse(withoutKeywords).success).toBe(false)
  })
})

describe('aiAnalysisSchema + buildAnalysisResult', () => {
  it('fileName i pages pochodzą z pliku, nie z odpowiedzi modelu', () => {
    const aiOutput = {
      ...briefExample,
      document: { ...briefExample.document, fileName: 'zmyslone.pdf', pages: 999 },
    }
    const ai: AiAnalysis = aiAnalysisSchema.parse(aiOutput)
    const result = buildAnalysisResult(ai, { fileName: 'umowa.pdf', pages: 4 })

    expect(result.document.fileName).toBe('umowa.pdf')
    expect(result.document.pages).toBe(4)
    expect(analysisResultSchema.safeParse(result).success).toBe(true)
  })
})

describe('analyzeRequestSchema', () => {
  const valid = { fileName: 'a.pdf', pages: 1, text: 'x'.repeat(100) }

  it('akceptuje poprawne żądanie', () => {
    expect(analyzeRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('odrzuca zbyt krótki tekst (skan bez warstwy tekstowej)', () => {
    expect(analyzeRequestSchema.safeParse({ ...valid, text: 'abc' }).success).toBe(false)
  })

  it('odrzuca zbyt długi tekst', () => {
    expect(analyzeRequestSchema.safeParse({ ...valid, text: 'x'.repeat(400_001) }).success).toBe(
      false,
    )
  })
})

describe('analyzeScanMetaSchema', () => {
  it('przyjmuje liczbę stron jako tekst z query string', () => {
    expect(analyzeScanMetaSchema.parse({ fileName: 'skan.pdf', pages: '3' })).toEqual({
      fileName: 'skan.pdf',
      pages: 3,
    })
  })

  it('odrzuca skan powyżej limitu stron i brak nazwy pliku', () => {
    expect(analyzeScanMetaSchema.safeParse({ fileName: 'a.pdf', pages: '21' }).success).toBe(false)
    expect(analyzeScanMetaSchema.safeParse({ fileName: null, pages: '1' }).success).toBe(false)
  })
})
