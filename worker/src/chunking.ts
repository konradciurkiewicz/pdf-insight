/**
 * Dzieli tekst na fragmenty o długości <= maxChars, preferując granice akapitów,
 * potem linii, potem słów. Twarde cięcie tylko gdy nie ma innej możliwości.
 */
export function splitIntoChunks(text: string, maxChars: number): string[] {
  if (maxChars <= 0) throw new Error('maxChars must be positive')
  const chunks: string[] = []
  let rest = text.trim()

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars)
    // Nie tniemy w pierwszej połowie okna — inaczej powstałyby bardzo krótkie fragmenty.
    const minCut = Math.floor(maxChars / 2)
    const cut = [
      window.lastIndexOf('\n\n'),
      window.lastIndexOf('\n'),
      window.lastIndexOf(' '),
    ].find((index) => index >= minCut)
    const end = cut ?? maxChars
    chunks.push(rest.slice(0, end).trim())
    rest = rest.slice(end).trim()
  }

  if (rest.length > 0) chunks.push(rest)
  return chunks
}
