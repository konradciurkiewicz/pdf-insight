# Znane ograniczenia

- **OCR tylko dla „czystych” skanów** — skan jest wykrywany, gdy cały PDF ma < 50 znaków tekstu.
  Dokument mieszany (część stron tekstowa, część zeskanowana) idzie ścieżką tekstową i strony-skany
  są pomijane. Limit OCR: 4 MB i 20 stron ([ADR 0006](decisions/0006-ocr-via-gemini.md)).
- **Liczba zdań w `summary`** nie jest walidowana schematem — tylko promptem (patrz `schema.md`).
- **Tabele w PDF** — pdf.js zwraca tekst bez struktury tabeli; kwoty z tabel model odczytuje z
  kontekstu, co bywa mniej dokładne.
- **Bardzo długie dokumenty** (>120k znaków) — kilka wywołań AI; przy darmowym limicie Gemini
  (żądania/minutę) analiza może trwać dłużej niż 30 s lub trafić na limit.
- **Historia** zapisuje się tylko w danej przeglądarce (localStorage, maks. 10 wpisów).
