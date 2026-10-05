/** Błąd odczytu PDF z komunikatem gotowym do pokazania użytkownikowi. */
export class PdfReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfReadError'
  }
}
