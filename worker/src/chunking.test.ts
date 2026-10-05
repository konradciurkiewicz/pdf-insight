import { describe, expect, it } from 'vitest'
import { splitIntoChunks } from './chunking'

describe('splitIntoChunks', () => {
  it('krótki tekst zwraca jako jeden fragment', () => {
    expect(splitIntoChunks('  krótki tekst  ', 100)).toEqual(['krótki tekst'])
  })

  it('żaden fragment nie przekracza limitu i nic nie ginie', () => {
    const text = Array.from({ length: 200 }, (_, i) => `Akapit ${i} z treścią.`).join('\n\n')
    const chunks = splitIntoChunks(text, 500)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(500)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '))
  })

  it('preferuje granicę akapitu', () => {
    const text = `${'a'.repeat(60)}\n\n${'b'.repeat(60)}`
    expect(splitIntoChunks(text, 100)).toEqual(['a'.repeat(60), 'b'.repeat(60)])
  })

  it('tnie twardo tekst bez spacji', () => {
    expect(splitIntoChunks('x'.repeat(250), 100)).toEqual([
      'x'.repeat(100),
      'x'.repeat(100),
      'x'.repeat(50),
    ])
  })
})
