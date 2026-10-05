import { LIMITS } from '@pdf-insight/shared'

export type FileValidation = { ok: true } | { ok: false; message: string }

const PDF_MAGIC = '%PDF-'

/** Walidacja przed odczytem (brief F-01): tylko PDF, maks. 10 MB. */
export async function validatePdfFile(file: File): Promise<FileValidation> {
  if (file.size === 0) return { ok: false, message: 'Plik jest pusty.' }
  if (file.size > LIMITS.maxFileBytes) {
    const maxMb = LIMITS.maxFileBytes / 1024 / 1024
    return { ok: false, message: `Plik jest za duży. Maksymalny rozmiar to ${maxMb} MB.` }
  }

  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!looksLikePdf) return { ok: false, message: 'Obsługiwane są tylko pliki PDF.' }

  // Rozszerzenie i MIME można podrobić — sprawdzamy sygnaturę pliku.
  const header = new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer())
  if (!header.includes(PDF_MAGIC)) {
    return { ok: false, message: 'Plik nie jest poprawnym dokumentem PDF.' }
  }
  return { ok: true }
}
