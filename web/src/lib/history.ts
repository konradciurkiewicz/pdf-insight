import { z } from 'zod'
import { analysisResultSchema, type AnalysisResult } from '@pdf-insight/shared'

const STORAGE_KEY = 'pdf-insight:history:v1'
export const HISTORY_LIMIT = 10

const historyEntrySchema = z.object({
  id: z.string(),
  analyzedAt: z.iso.datetime(),
  result: analysisResultSchema,
})

export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** Historia analiz w localStorage (brief F-09). Dane z localStorage też walidujemy — mogły się zmienić. */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw))
    if (!parsed.success) return []
    // Pojedynczy uszkodzony wpis nie kasuje całej historii.
    return parsed.data.flatMap((entry) => {
      const result = historyEntrySchema.safeParse(entry)
      return result.success ? [result.data] : []
    })
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Brak miejsca lub tryb prywatny — historia jest dodatkiem, aplikacja działa dalej.
  }
}

export function addToHistory(result: AnalysisResult): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    analyzedAt: new Date().toISOString(),
    result,
  }
  const entries = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT)
  saveHistory(entries)
  return entries
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const entries = loadHistory().filter((entry) => entry.id !== id)
  saveHistory(entries)
  return entries
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // jw.
  }
}
