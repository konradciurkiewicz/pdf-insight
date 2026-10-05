# 0002 — Cloudflare Workers + Gemini 2.5 Flash

**Status:** przyjęta

## Kontekst

GitHub Pages hostuje tylko pliki statyczne — klucz API musi być na backendzie. Demo musi działać
min. 14 dni na darmowych limitach, a odpowiedź ma przyjść w < 30 s.

## Decyzja

- Backend: **Cloudflare Worker** (TypeScript, darmowy plan, brak cold startów, natywny rate limit).
- LLM: **Gemini 2.5 Flash** — darmowy limit w Google AI Studio, structured output z JSON Schema,
  duży kontekst. `thinkingBudget: 0` — ekstrakcja nie wymaga rozumowania, a to skraca czas.
- Model konfigurowalny przez `GEMINI_MODEL` (zmiana bez zmian w kodzie).

## Rozważone alternatywy

- Python/FastAPI na Render — darmowy plan usypia serwer (cold start ~30–60 s łamie wymóg < 30 s).
- Claude Haiku — lepsza jakość instrukcji, ale brak darmowego planu API.
- Vercel Functions — porównywalne; Workers wybrane ze względu na wbudowany rate limiting.
