import { describe, expect, it } from 'vitest'
import { exportFileName, formatAmount, formatIsoDate } from './format'
import { normalizeText } from './text'
import { validatePdfFile } from './validateFile'

const pdfBytes = '%PDF-1.7\n%âãÏÓ\n1 0 obj\n'

describe('validatePdfFile', () => {
  it('akceptuje plik PDF z poprawną sygnaturą', async () => {
    const file = new File([pdfBytes], 'umowa.pdf', { type: 'application/pdf' })
    expect(await validatePdfFile(file)).toEqual({ ok: true })
  })

  it('odrzuca plik o innym rozszerzeniu i typie', async () => {
    const file = new File(['hello'], 'notatki.txt', { type: 'text/plain' })
    expect(await validatePdfFile(file)).toMatchObject({ ok: false })
  })

  it('odrzuca plik z rozszerzeniem .pdf, który nie jest PDF-em', async () => {
    const file = new File(['<html>'], 'fałszywy.pdf', { type: 'application/pdf' })
    const result = await validatePdfFile(file)
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('poprawnym') })
  })

  it('odrzuca plik większy niż 10 MB', async () => {
    const big = new File([pdfBytes, new Uint8Array(10 * 1024 * 1024)], 'duzy.pdf', {
      type: 'application/pdf',
    })
    expect(await validatePdfFile(big)).toMatchObject({ ok: false })
  })

  it('odrzuca pusty plik', async () => {
    expect(await validatePdfFile(new File([], 'pusty.pdf'))).toMatchObject({ ok: false })
  })
})

describe('normalizeText', () => {
  it('scala białe znaki (w tym NBSP), zachowuje akapity', () => {
    expect(normalizeText('  Ala  ma \t kota \n\n\n\n Nowy   akapit  ')).toBe(
      'Ala ma kota\n\nNowy akapit',
    )
  })
})

describe('format', () => {
  it('formatuje datę ISO bez przesunięcia strefy czasowej', () => {
    expect(formatIsoDate('2026-10-01')).toBe('01.10.2026')
  })

  it('formatuje kwotę w walucie dokumentu', () => {
    expect(formatAmount(12500, 'PLN').replace(/\s/g, ' ')).toBe('12 500,00 zł')
  })

  it('tworzy bezpieczną nazwę pliku eksportu', () => {
    expect(exportFileName('Umowa serwisowa (final).PDF')).toBe(
      'Umowa_serwisowa_final_.analysis.json',
    )
    expect(exportFileName('../../etc.pdf')).toBe('.._.._etc.analysis.json')
  })
})
