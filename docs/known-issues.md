# Znane ograniczenia

- **Brak OCR** (brief F-10, COULD) — skany bez warstwy tekstowej są wykrywane (tekst < 50 znaków)
  i użytkownik dostaje komunikat. Możliwe rozszerzenie: Gemini przyjmuje PDF/obrazy natywnie.
- **Liczba zdań w `summary`** nie jest walidowana schematem — tylko promptem (patrz `schema.md`).
- **Tabele w PDF** — pdf.js zwraca tekst bez struktury tabeli; kwoty z tabel model odczytuje z
  kontekstu, co bywa mniej dokładne.
- **Bardzo długie dokumenty** (>120k znaków) — kilka wywołań AI; przy darmowym limicie Gemini
  (żądania/minutę) analiza może trwać dłużej niż 30 s lub trafić na limit.
- **Historia** zapisuje się tylko w danej przeglądarce (localStorage, maks. 10 wpisów).
