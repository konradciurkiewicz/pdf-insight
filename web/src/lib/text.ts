/** Usuwa nadmiarowe spacje i puste linie — mniej tokenów, ta sama treść. */
export function normalizeText(text: string): string {
  return (
    text
      // Wszystkie białe znaki poza \n (w tym NBSP i tabulatory) → jedna spacja.
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
