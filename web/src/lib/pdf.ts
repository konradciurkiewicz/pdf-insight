import { getDocument, GlobalWorkerOptions, PasswordException } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
// `?url` — Vite kopiuje workera do builda i zwraca ścieżkę z uwzględnieniem `base` (GitHub Pages).
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfReadError } from './errors'
import { normalizeText } from './text'

GlobalWorkerOptions.workerSrc = workerUrl

export interface ExtractedPdf {
  text: string
  pages: number
}

/** Ekstrakcja tekstu po stronie przeglądarki — do backendu trafia tylko tekst, nie cały plik. */
export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const data = new Uint8Array(await file.arrayBuffer())

  const loadingTask = getDocument({ data })
  let pdf
  try {
    pdf = await loadingTask.promise
  } catch (error) {
    if (error instanceof PasswordException) {
      throw new PdfReadError('Plik PDF jest zabezpieczony hasłem.')
    }
    throw new PdfReadError('Nie udało się odczytać pliku PDF. Plik może być uszkodzony.')
  }

  try {
    const pageTexts: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str + (item.hasEOL ? '\n' : ''))
        .join('')
      pageTexts.push(pageText.trim())
      page.cleanup()
    }
    return { text: normalizeText(pageTexts.join('\n\n')), pages: pdf.numPages }
  } finally {
    await loadingTask.destroy()
  }
}
