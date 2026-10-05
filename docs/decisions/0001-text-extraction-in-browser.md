# 0001 — Ekstrakcja tekstu w przeglądarce (pdf.js)

**Status:** przyjęta

## Kontekst

Plik PDF (do 10 MB) można wysłać w całości do backendu/LLM albo wyciągnąć tekst lokalnie.

## Decyzja

Tekst wyciąga przeglądarka (pdf.js); do Workera trafia tylko `{fileName, pages, text}`.

## Konsekwencje

- (+) Mniejsze żądania (KB zamiast MB), mniejsze zużycie tokenów i krótszy czas — cel < 30 s.
- (+) Plik nie opuszcza komputera użytkownika; liczba stron jest faktem, nie oceną modelu.
- (+) Skany bez warstwy tekstowej wykrywamy przed wywołaniem AI (bez zużywania limitu).
- (−) Brak OCR i struktury tabel. Rozszerzenie: fallback wysyłający PDF do Gemini (obsługuje PDF).
- (−) pdf.js jest duży (~430 kB) — ładowany leniwie przy pierwszym pliku.
