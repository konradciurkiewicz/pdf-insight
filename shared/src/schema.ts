import { z } from 'zod'

/** Dozwolone typy dokumentu (brief, sekcja 04). Wartości po polsku — tak definiuje je schemat. */
export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const

/** ISO 8601, sama data: YYYY-MM-DD (z walidacją zakresu miesiąca/dnia). */
const isoDate = z.iso.date()

/** ISO 639-1: dwie małe litery, np. "pl", "en". */
const languageCode = z.string().regex(/^[a-z]{2}$/, 'Kod języka musi być w formacie ISO 639-1')

/** ISO 4217: trzy wielkie litery, np. "PLN", "EUR". */
const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Kod waluty musi być w formacie ISO 4217')

const nonEmptyText = z.string().trim().min(1)

/**
 * Część wyniku generowana przez model. Pola `fileName` i `pages` nie pochodzą od AI —
 * ustawia je serwer na podstawie samego pliku, więc model nie może ich „zmyślić”.
 */
export const aiDocumentSchema = z.object({
  language: languageCode,
  type: z.enum(DOCUMENT_TYPES),
  title: nonEmptyText.nullable(),
  date: isoDate.nullable(),
})

export const aiAnalysisSchema = z.object({
  document: aiDocumentSchema,
  summary: nonEmptyText.max(2000),
  keyPoints: z.array(nonEmptyText).min(3).max(7),
  entities: z.object({
    organizations: z.array(nonEmptyText),
    people: z.array(nonEmptyText),
  }),
  amounts: z.array(
    z.object({
      value: z.number().finite(),
      currency: currencyCode,
      context: nonEmptyText,
    }),
  ),
  dates: z.array(
    z.object({
      date: isoDate,
      context: nonEmptyText,
    }),
  ),
  keywords: z.array(nonEmptyText),
})

/** Pełny wynik analizy — format eksportowany do pliku .json (brief, sekcja 04). */
export const analysisResultSchema = aiAnalysisSchema.extend({
  // Jawna kolejność pól — Zod zwraca klucze w kolejności schematu, a eksport ma wyglądać jak w briefie.
  document: z.object({
    fileName: nonEmptyText,
    pages: z.number().int().positive(),
    ...aiDocumentSchema.shape,
  }),
})

export type DocumentType = (typeof DOCUMENT_TYPES)[number]
export type AiAnalysis = z.infer<typeof aiAnalysisSchema>
export type AnalysisResult = z.infer<typeof analysisResultSchema>

/** Łączy odpowiedź modelu z metadanymi pliku znanymi po stronie aplikacji. */
export function buildAnalysisResult(
  ai: AiAnalysis,
  file: { fileName: string; pages: number },
): AnalysisResult {
  return {
    ...ai,
    document: {
      fileName: file.fileName,
      pages: file.pages,
      ...ai.document,
    },
  }
}
