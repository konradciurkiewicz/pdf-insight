# Bezpieczeństwo

| Zagrożenie                     | Zabezpieczenie                                                                                                                                | Gdzie                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Wyciek klucza API              | Klucz tylko w sekretach Workera; `.env` w `.gitignore`; gitleaks w CI                                                                         | `worker/`, `pipeline.yml`     |
| Klucz w historii Git           | gitleaks skanuje **całą** historię (`fetch-depth: 0`) w każdym PR                                                                             | `pipeline.yml`                |
| Nadużycie API (koszty/limit)   | CORS + odrzucenie obcych originów (403), rate limit IP 5/min, global 30/min                                                                   | `worker/src/index.ts`         |
| Duże żądania                   | Plik ≤10 MB (front), tekst ≤400k znaków, body ≤~1,6 MB (worker)                                                                               | `shared/src/api.ts`           |
| Prompt injection z treści PDF  | Tekst tylko w wiadomości użytkownika, w `<document>`; neutralizacja tagów; instrukcja „dane, nie polecenia”; structured output; walidacja Zod | `worker/src/prompt.ts`        |
| Model „zmyśla” metadane pliku  | `fileName`/`pages` ustawiane przez serwer, nie przez model                                                                                    | `shared/src/schema.ts`        |
| XSS z treści PDF / AI          | Zakaz `dangerouslySetInnerHTML` (reguła ESLint); React escapuje tekst                                                                         | `eslint.config.js`            |
| Podrobiony plik                | Sprawdzenie sygnatury `%PDF-`, nie tylko rozszerzenia                                                                                         | `web/src/lib/validateFile.ts` |
| Wyciek szczegółów błędów       | Treść błędu Gemini tylko w logach Workera; klient dostaje kod + komunikat                                                                     | `worker/src/gemini.ts`        |
| Uszkodzone dane w localStorage | Walidacja historii schematem przy odczycie                                                                                                    | `web/src/lib/history.ts`      |
| Podatne zależności             | Dependabot (npm + Actions), `npm audit` przy instalacji                                                                                       | `.github/dependabot.yml`      |
| Prywatność                     | Informacja w UI, że tekst trafia do Google Gemini; plik nie opuszcza przeglądarki — tylko tekst                                               | `web/src/App.tsx`             |

## Świadome ograniczenia

- CORS nie chroni przed wywołaniami spoza przeglądarki (curl może podrobić `Origin`). Ochroną
  kosztów jest rate limit + darmowy limit Gemini (brak karty = brak rachunku).
- Rate limit Cloudflare jest „eventually consistent” per lokalizacja — to ochrona przed
  nadużyciem, nie precyzyjny licznik.
- Darmowy plan Gemini może wykorzystywać dane wejściowe do ulepszania modeli — stąd ostrzeżenie
  w UI, by nie wgrywać danych wrażliwych.
