# 0004 — Długie dokumenty: map-reduce z deterministycznym scalaniem faktów

**Status:** przyjęta

## Kontekst

F-08 (SHOULD): dzielenie tekstu na fragmenty i łączenie wyników. Gemini ma duży kontekst, ale
darmowy plan ogranicza tokeny/minutę, a długi kontekst wydłuża odpowiedź.

## Decyzja

- Tekst ≤ 120k znaków → jedno wywołanie.
- Dłuższy → podział na granicach akapitów (`splitIntoChunks`), równoległa analiza fragmentów
  (map), a potem jedno wywołanie scalające (reduce) na **wynikach JSON**, nie surowym tekście.
- Listy faktów (`entities`, `amounts`, `dates`) scalane **deterministycznie w kodzie**
  (unia bez duplikatów) — model przy scalaniu potrafi gubić pozycje. Od modelu bierzemy tylko
  `summary`, `keyPoints`, `keywords` i metadane.

## Konsekwencje

- (+) Żadna kwota/data z fragmentu nie ginie przy scalaniu.
- (−) Ten sam fakt opisany różnym `context` w dwóch fragmentach pojawi się dwukrotnie.
