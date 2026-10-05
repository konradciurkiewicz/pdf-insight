# Format wyniku

Źródło prawdy: [`shared/src/schema.ts`](../shared/src/schema.ts). Ten plik opisuje **reguły**, których
nie widać w samym kodzie.

| Pole                  | Reguła                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| `document.fileName`   | Z pliku, **nie od modelu** (`buildAnalysisResult`)                        |
| `document.pages`      | Z pdf.js, **nie od modelu**                                               |
| `document.language`   | ISO 639-1, `^[a-z]{2}$`                                                   |
| `document.type`       | `faktura` \| `umowa` \| `oferta` \| `raport` \| `inne`                    |
| `document.title/date` | `null`, jeśli brak w dokumencie; data `YYYY-MM-DD` (walidacja kalendarza) |
| `summary`             | 3–5 zdań (wymuszane promptem; schemat sprawdza tylko niepustość/długość)  |
| `keyPoints`           | 3–7 pozycji (wymuszane schematem)                                         |
| `amounts[].currency`  | ISO 4217, `^[A-Z]{3}$`; `value` to liczba                                 |
| `dates[].date`        | `YYYY-MM-DD`; daty niepełne pomijane                                      |

## Zasady zmian

- Pola można **dodawać**, nie wolno ich **usuwać** (brief, sekcja 04).
- Klucze po angielsku, wartości w języku dokumentu.
- Liczby zdań w `summary` celowo nie walidujemy w Zod — skróty („sp. z o.o.”, „ul.”) psują
  liczenie zdań i powodowałyby fałszywe odrzucenia (patrz `known-issues.md`).
- JSON Schema dla Gemini generowany jest z `aiAnalysisSchema` przez `z.toJSONSchema` —
  zmiana schematu automatycznie zmienia instrukcję strukturalną dla modelu.
