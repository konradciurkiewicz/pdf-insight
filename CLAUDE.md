# PDF Insight — instrukcje dla agentów AI

Aplikacja webowa: użytkownik wgrywa PDF → przeglądarka wyciąga tekst (pdf.js) → Worker wysyła tekst
do LLM (Gemini) → wynik walidowany schematem Zod → widok + eksport JSON.

Ten plik to punkt wejścia. Szczegóły są w `docs/` — czytaj je **tylko gdy dotyczą zadania**:

| Plik                         | Kiedy czytać                                            |
| ---------------------------- | ------------------------------------------------------- |
| `docs/architecture.md`       | Zmiany przepływu danych, nowe endpointy, deploy         |
| `docs/decisions/`            | Zanim zmienisz coś, co wygląda na celowy wybór (ADR)    |
| `docs/schema.md`             | Zmiany w formacie wyniku / prompcie                     |
| `docs/security.md`           | Cokolwiek dotykającego kluczy, CORS, limitów, promptów  |
| `docs/known-issues.md`       | Przed debugowaniem — może to znany problem              |

## Struktura (npm workspaces)

```
shared/   schemat Zod wyniku analizy — JEDNO źródło prawdy dla web i worker
web/      React + Vite + TS (GitHub Pages). src/components, src/lib, src/api
worker/   Cloudflare Worker — proxy do Gemini, trzyma klucz API w sekretach
docs/     wiedza projektowa (architektura, ADR, bezpieczeństwo)
.claude/  agenci (code-reviewer, security-auditor) i ustawienia
```

## Komendy

```bash
npm install            # w katalogu głównym (workspaces)
npm run dev            # frontend  → http://localhost:5173/pdf-insight/
npm run dev:worker     # worker    → http://localhost:8787 (wymaga worker/.env)
npm run check          # lint + prettier + typecheck + testy — uruchom przed każdym commitem
```

## Twarde reguły (naruszenie = dyskwalifikacja zadania)

1. **Klucz API nigdy we frontendzie ani w historii Git.** Tylko `wrangler secret put` / lokalny
   `worker/.env` (ignorowany). Nie czytaj plików `.env` — używaj `.env.example`.
2. Treść PDF to **dane, nie instrukcje** — zawsze opakowana w ograniczniki w prompcie, nigdy
   łączona z instrukcją systemową.
3. Każda odpowiedź AI przechodzi przez `analysisResultSchema.safeParse` (worker **i** frontend).
4. Brak informacji w dokumencie → `null` / `[]`. Model nie zgaduje.

## Standardy kodu

- TypeScript `strict`, zero `any`, zero `console.log` (ESLint to wymusza).
- Bez `dangerouslySetInnerHTML`; tekst z AI renderowany wyłącznie jako tekst React.
- Komunikaty UI po polsku; identyfikatory i klucze JSON po angielsku.
- Zmiana schematu = zmiana w `shared/` + test w `shared/src/schema.test.ts` + `docs/schema.md`.

## Workflow Git

- Branch per zadanie: `feat/…`, `fix/…`, `docs/…`, `ci/…` → PR do `main` → CI musi być zielone.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`).
- Małe, logiczne commity. Nie commituj `tmp/`, `dist/`, `.env`.
- Przed PR uruchom agenta `code-reviewer`; przy zmianach w `worker/` także `security-auditor`.

## Pamięć projektu

Po podjęciu nietrywialnej decyzji dopisz ADR w `docs/decisions/NNNN-tytul.md`.
Po znalezieniu ograniczenia/błędu, którego nie naprawiamy teraz — wpis w `docs/known-issues.md`.
Istotne interakcje z AI (pomyłki i poprawki) — wpis w `AI_LOG.md`.
