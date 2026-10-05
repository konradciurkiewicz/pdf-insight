# Architektura

```
┌──────────────────────── przeglądarka ────────────────────────┐
│ React SPA (GitHub Pages)                                      │
│  1. walidacja pliku (PDF, ≤10 MB, sygnatura %PDF-)            │
│  2. pdf.js → tekst + liczba stron (plik nie opuszcza maszyny) │
│  3. POST {fileName, pages, text} ─────────────┐               │
│  6. Zod safeParse → widok, JSON, historia      │               │
└────────────────────────────────────────────────┼──────────────┘
                                                 ▼
┌──────────── Cloudflare Worker (pdf-insight-api) ─────────────┐
│ CORS (ALLOWED_ORIGINS) → rate limit (IP + globalny)           │
│ → limit rozmiaru → Zod (analyzeRequestSchema)                 │
│ 4. tekst ≤120k znaków: 1 wywołanie; dłuższy: map → reduce     │
│ 5. Zod (aiAnalysisSchema), 1 ponowna próba z opisem błędu     │
│    + fileName/pages z żądania (nie od modelu)                 │
└────────────────────────────────────────────────┬──────────────┘
                                                 ▼
                         Gemini API (structured output, JSON Schema z Zod)
```

## Moduły

| Ścieżka                  | Odpowiedzialność                                             |
| ------------------------ | ------------------------------------------------------------ |
| `shared/src/schema.ts`   | Schemat wyniku (Zod) — źródło typów, walidacji i JSON Schema |
| `shared/src/api.ts`      | Kontrakt HTTP i wspólne limity (`LIMITS`)                    |
| `worker/src/index.ts`    | Routing, CORS, rate limit, mapowanie błędów na HTTP          |
| `worker/src/analyze.ts`  | Walidacja + ponowienie, dzielenie i scalanie długich tekstów |
| `worker/src/gemini.ts`   | Klient Gemini (jedyne miejsce z kluczem API)                 |
| `worker/src/prompt.ts`   | Prompty i ograniczniki danych (prompt injection)             |
| `web/src/lib/pdf.ts`     | Ekstrakcja tekstu (pdf.js, ładowany leniwie)                 |
| `web/src/api/analyze.ts` | Wywołanie API, walidacja odpowiedzi, komunikaty błędów       |
| `web/src/App.tsx`        | Maszyna stanów UI: idle → working → done / error             |

## Kontrakt API

`POST /api/analyze` — body: `{ fileName, pages, text }` (patrz `analyzeRequestSchema`).

| Status | `error.code`          | Kiedy                                  |
| ------ | --------------------- | -------------------------------------- |
| 200    | —                     | `{ ok: true, result: AnalysisResult }` |
| 400    | `BAD_REQUEST`         | Niepoprawne dane                       |
| 403    | `BAD_REQUEST`         | Origin spoza `ALLOWED_ORIGINS`         |
| 413    | `PAYLOAD_TOO_LARGE`   | Za duże body / za dużo tekstu          |
| 429    | `RATE_LIMITED`        | Limit żądań                            |
| 502    | `AI_INVALID_RESPONSE` | 2× odpowiedź niezgodna ze schematem    |
| 503    | `AI_UNAVAILABLE`      | Błąd / limit po stronie Gemini         |

`GET /api/health` — `{ ok: true }`.

## Deploy

- **Frontend:** `.github/workflows/pipeline.yml` — lint › build › deploy na GitHub Pages z `main`.
  `VITE_API_URL` = zmienna repozytorium (Settings › Secrets and variables › Actions › Variables).
- **Worker:** `.github/workflows/deploy-worker.yml` — `wrangler deploy` przy zmianach w `worker/` lub
  `shared/`. Wymaga sekretów repo `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
  `GEMINI_API_KEY` ustawiany raz: `npx wrangler secret put GEMINI_API_KEY` (nie trafia do GitHub).
