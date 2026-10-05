# 0003 — Jeden schemat Zod dla frontu, workera i modelu

**Status:** przyjęta

## Kontekst

Format wyniku musi być identyczny w trzech miejscach: instrukcja dla modelu, walidacja na
backendzie, walidacja przed wyświetleniem (F-04). Ręczna synchronizacja trzech definicji to
gwarantowany rozjazd.

## Decyzja

- `shared/` (npm workspace) eksportuje schematy Zod; typy TS przez `z.infer`.
- JSON Schema dla Gemini generowany z tego samego schematu (`z.toJSONSchema`).
- Model generuje `aiAnalysisSchema` (bez `fileName`/`pages`); serwer dokleja metadane pliku —
  model nie może ich „zmyślić”.
- Walidacja dwukrotna: Worker (z 1 ponowną próbą) i frontend (nie ufamy nawet własnemu API).

## Konsekwencje

- (+) Zmiana schematu w jednym miejscu; testy w `shared/` pilnują kontraktu.
- (−) Ograniczenia JSON Schema obsługiwane przez Gemini — ewentualne niewspierane słowa kluczowe
  trzeba odfiltrować przed wysłaniem (walidacja Zod i tak jest pełna po naszej stronie).
