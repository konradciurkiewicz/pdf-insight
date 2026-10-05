# 0005 — Łańcuch modeli Gemini zamiast jednego modelu

**Status:** przyjęta (zastępuje wybór modelu z 0002)

## Kontekst

Testy na żywym API (5.10.2026) z darmowym kluczem pokazały, że Gemini regularnie zwraca
`503 UNAVAILABLE — "This model is currently experiencing high demand"`. W jednym przebiegu 503
dostały `gemini-2.5-flash`, `gemini-flash-latest`, `gemini-3.8-flash` i `gemini-2.5-flash-lite`.
Demo musi działać min. 14 dni bez nadzoru.

Pomiar na tej samej umowie (2 strony), structured output z naszym schematem:

| Model                   | `thinkingConfig`         | Wynik         |
| ----------------------- | ------------------------ | ------------- |
| `gemini-3.5-flash`      | `thinkingLevel: minimal` | 200, 4,1 s ✓  |
| `gemini-3.5-flash`      | `thinkingBudget: 0`      | 200, 19,6 s ✓ |
| `gemini-3.5-flash-lite` | `thinkingLevel: minimal` | 200, 3,4 s ✓  |
| `gemini-3.5-flash-lite` | `thinkingBudget: 0`      | 400           |
| `gemini-2.5-flash`      | `thinkingBudget: 0`      | 200, 5,3 s ✓  |
| `gemini-2.5-flash`      | `thinkingLevel: minimal` | 400           |

## Decyzja

- `GEMINI_MODELS` = lista modeli w kolejności preferencji:
  `gemini-3.5-flash,gemini-2.5-flash,gemini-3.5-flash-lite`. Przy 429/5xx/timeoucie klient
  przechodzi na kolejny model; przy 400 (błąd konfiguracji) — nie.
- `thinkingConfig` dobierany do generacji: 2.x → `thinkingBudget: 0`, 3.x → `thinkingLevel: minimal`.
- Konkretne wersje zamiast aliasów `-latest` — alias może zmienić model i jego parametry bez
  ostrzeżenia (np. `gemini-flash-latest` odrzuca `minimal`).
- Timeout na model: 20 s (szybkie przejście na kolejny zamiast czekania).

## Konsekwencje

- (+) Pojedynczy przeciążony model nie psuje demo; test długiego dokumentu przeszedł mimo 503.
- (−) Wyniki mogą się nieznacznie różnić w zależności od modelu, który odpowiedział.
- (−) Zmiana listy modeli wymaga sprawdzenia, czy przyjmują `thinkingConfig` (test w `gemini.test.ts`).
