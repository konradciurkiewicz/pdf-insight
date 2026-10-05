import type { HistoryEntry } from '../lib/history'
import { DOCUMENT_TYPE_LABELS } from '../lib/format'

interface HistoryListProps {
  entries: HistoryEntry[]
  activeId: string | null
  onOpen: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}

const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' })

export function HistoryList({ entries, activeId, onOpen, onRemove, onClear }: HistoryListProps) {
  if (entries.length === 0) return null

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history__header">
        <h2 id="history-title">Ostatnie analizy</h2>
        <button type="button" className="link-button" onClick={onClear}>
          Wyczyść historię
        </button>
      </div>
      <p className="muted small">Zapisane tylko w tej przeglądarce.</p>
      <ul className="history__list">
        {entries.map((entry) => (
          <li key={entry.id} className={entry.id === activeId ? 'is-active' : undefined}>
            <button type="button" className="history__open" onClick={() => onOpen(entry)}>
              <span className="history__name">{entry.result.document.fileName}</span>
              <span className="muted small">
                {DOCUMENT_TYPE_LABELS[entry.result.document.type]} ·{' '}
                {dateTimeFormat.format(new Date(entry.analyzedAt))}
              </span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Usuń ${entry.result.document.fileName} z historii`}
              onClick={() => onRemove(entry.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
