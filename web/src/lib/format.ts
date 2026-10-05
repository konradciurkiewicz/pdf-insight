import type { AnalysisResult, DocumentType } from '@pdf-insight/shared'

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
}

/** YYYY-MM-DD → DD.MM.YYYY bez użycia Date (unikamy przesunięć strefy czasowej). */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return year && month && day ? `${day}.${month}.${year}` : isoDate
}

export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value)
  } catch {
    return `${value} ${currency}`
  }
}

export function formatLanguage(code: string): string {
  try {
    return new Intl.DisplayNames(['pl'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export function toJsonString(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2)
}

/** Nazwa pliku eksportu: umowa.pdf → umowa.analysis.json (bez znaków niedozwolonych w nazwach). */
export function exportFileName(pdfName: string): string {
  const base = pdfName.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}._-]+/gu, '_') || 'dokument'
  return `${base}.analysis.json`
}

export function downloadJson(result: AnalysisResult): void {
  const blob = new Blob([toJsonString(result)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFileName(result.document.fileName)
  link.click()
  URL.revokeObjectURL(url)
}
