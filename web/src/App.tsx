import { useState } from 'react'
import { LIMITS, type AnalysisResult, type AnalyzeRequest } from '@pdf-insight/shared'
import { analyzeText, AnalyzeError } from './api/analyze'
import { DropZone } from './components/DropZone'
import { ErrorPanel } from './components/ErrorPanel'
import { HistoryList } from './components/HistoryList'
import { ProgressStatus, type ProgressStep } from './components/ProgressStatus'
import { ResultView } from './components/ResultView'
import {
  addToHistory,
  clearHistory,
  loadHistory,
  removeFromHistory,
  type HistoryEntry,
} from './lib/history'
import { PdfReadError } from './lib/errors'
import { validatePdfFile } from './lib/validateFile'

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; fileName: string; step: ProgressStep }
  | { kind: 'done'; result: AnalysisResult; historyId: string | null }
  /** `retry` — tekst ostatniego pliku: ponawiamy samą analizę AI, bez ponownego odczytu PDF. */
  | { kind: 'error'; message: string; retry: AnalyzeRequest | null }

function errorMessage(error: unknown): string {
  if (error instanceof PdfReadError || error instanceof AnalyzeError) return error.message
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)

  async function runAnalysis(request: AnalyzeRequest) {
    setPhase({ kind: 'working', fileName: request.fileName, step: 'analyzing' })
    try {
      const result = await analyzeText(request)
      const entries = addToHistory(result)
      setHistory(entries)
      setPhase({ kind: 'done', result, historyId: entries[0]?.id ?? null })
    } catch (error) {
      const retryable = !(error instanceof AnalyzeError && error.code === 'PAYLOAD_TOO_LARGE')
      setPhase({ kind: 'error', message: errorMessage(error), retry: retryable ? request : null })
    }
  }

  async function handleFile(file: File) {
    const validation = await validatePdfFile(file)
    if (!validation.ok) {
      setPhase({ kind: 'error', message: validation.message, retry: null })
      return
    }

    setPhase({ kind: 'working', fileName: file.name, step: 'reading' })
    let extracted
    try {
      // pdf.js (~700 kB) ładujemy dopiero przy pierwszym pliku — szybszy pierwszy ekran.
      const { extractPdfText } = await import('./lib/pdf')
      extracted = await extractPdfText(file)
    } catch (error) {
      setPhase({ kind: 'error', message: errorMessage(error), retry: null })
      return
    }

    if (extracted.text.length < LIMITS.minTextChars) {
      setPhase({
        kind: 'error',
        message:
          'Nie znaleziono tekstu w tym PDF. Prawdopodobnie to skan lub same obrazy — ' +
          'aplikacja obsługuje tylko pliki z warstwą tekstową.',
        retry: null,
      })
      return
    }
    if (extracted.text.length > LIMITS.maxTextChars) {
      setPhase({
        kind: 'error',
        message: `Dokument zawiera zbyt dużo tekstu (limit to ok. ${LIMITS.maxTextChars.toLocaleString('pl-PL')} znaków).`,
        retry: null,
      })
      return
    }

    await runAnalysis({ fileName: file.name, pages: extracted.pages, text: extracted.text })
  }

  const reset = () => setPhase({ kind: 'idle' })
  const isWorking = phase.kind === 'working'

  return (
    <div className="app">
      <header className="app__header">
        <p className="eyebrow">PDF Insight</p>
        <h1>Podsumowanie i dane z PDF w kilka sekund</h1>
        <p className="lead">
          Wgraj dokument — otrzymasz krótkie podsumowanie, kluczowe punkty, kwoty, daty i podmioty
          oraz plik JSON do pobrania.
        </p>
      </header>

      <main className="app__main">
        {phase.kind === 'idle' && (
          <>
            <DropZone onFile={handleFile} />
            <p className="notice">
              <strong>Prywatność:</strong> tekst z pliku jest wysyłany do zewnętrznej usługi AI
              (Google Gemini) wyłącznie w celu analizy. Nie wgrywaj dokumentów zawierających dane
              wrażliwe. Wyniki zapisują się tylko w Twojej przeglądarce.
            </p>
          </>
        )}

        {phase.kind === 'working' && <ProgressStatus fileName={phase.fileName} step={phase.step} />}

        {phase.kind === 'error' && (
          <ErrorPanel
            message={phase.message}
            onReset={reset}
            onRetry={phase.retry ? () => phase.retry && runAnalysis(phase.retry) : undefined}
          />
        )}

        {phase.kind === 'done' && <ResultView result={phase.result} onReset={reset} />}

        {phase.kind === 'idle' && history.length === 0 && (
          <section className="empty" aria-label="Jak to działa">
            <ol className="how">
              <li>
                <strong>Wgraj PDF</strong>
                <span>Umowa, faktura, oferta, raport…</span>
              </li>
              <li>
                <strong>Analiza AI</strong>
                <span>Podsumowanie w języku dokumentu, bez zmyślania</span>
              </li>
              <li>
                <strong>Wynik</strong>
                <span>Czytelny widok i eksport JSON</span>
              </li>
            </ol>
          </section>
        )}
      </main>

      {!isWorking && (
        <aside className="app__aside">
          <HistoryList
            entries={history}
            activeId={phase.kind === 'done' ? phase.historyId : null}
            onOpen={(entry) =>
              setPhase({ kind: 'done', result: entry.result, historyId: entry.id })
            }
            onRemove={(id) => setHistory(removeFromHistory(id))}
            onClear={() => {
              clearHistory()
              setHistory([])
            }}
          />
        </aside>
      )}

      <footer className="app__footer muted small">
        Wyniki generuje model AI i mogą zawierać błędy — weryfikuj ważne informacje w dokumencie
        źródłowym.
      </footer>
    </div>
  )
}
