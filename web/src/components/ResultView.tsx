import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AnalysisResult } from '@pdf-insight/shared'
import {
  DOCUMENT_TYPE_LABELS,
  downloadJson,
  formatAmount,
  formatIsoDate,
  formatLanguage,
  toJsonString,
} from '../lib/format'

type Tab = 'summary' | 'json'

interface ResultViewProps {
  result: AnalysisResult
  onReset: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h3 className="card__title">{title}</h3>
      {children}
    </section>
  )
}

function Empty() {
  return <p className="muted">Brak w dokumencie</p>
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <Empty />
  return (
    <ul className="tags">
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ul>
  )
}

export function ResultView({ result, onReset }: ResultViewProps) {
  const [tab, setTab] = useState<Tab>('summary')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { document: doc } = result

  useEffect(() => headingRef.current?.focus(), [result])

  return (
    <article className="result" aria-labelledby="result-title">
      <header className="result__header">
        <div>
          <p className="eyebrow">{DOCUMENT_TYPE_LABELS[doc.type]}</p>
          <h2 id="result-title" ref={headingRef} tabIndex={-1}>
            {doc.title ?? doc.fileName}
          </h2>
          <dl className="meta">
            <div>
              <dt>Plik</dt>
              <dd>{doc.fileName}</dd>
            </div>
            <div>
              <dt>Strony</dt>
              <dd>{doc.pages}</dd>
            </div>
            <div>
              <dt>Język</dt>
              <dd>{formatLanguage(doc.language)}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{doc.date ? formatIsoDate(doc.date) : '—'}</dd>
            </div>
          </dl>
        </div>
        <div className="actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => downloadJson(result)}
          >
            Pobierz JSON
          </button>
          <button type="button" className="button" onClick={onReset}>
            Nowa analiza
          </button>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Widok wyniku">
        {(
          [
            ['summary', 'Wyniki'],
            ['json', 'JSON'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className="tabs__tab"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' ? (
        <div id="panel-summary" role="tabpanel" aria-labelledby="tab-summary" className="grid">
          <Section title="Podsumowanie">
            <p className="summary">{result.summary}</p>
          </Section>

          <Section title="Kluczowe punkty">
            <ul className="list">
              {result.keyPoints.map((point, i) => (
                <li key={`${i}-${point}`}>{point}</li>
              ))}
            </ul>
          </Section>

          <Section title="Kwoty">
            {result.amounts.length === 0 ? (
              <Empty />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Kwota</th>
                    <th scope="col">Kontekst</th>
                  </tr>
                </thead>
                <tbody>
                  {result.amounts.map((amount, i) => (
                    <tr key={`${amount.value}-${amount.currency}-${i}`}>
                      <td className="nowrap">{formatAmount(amount.value, amount.currency)}</td>
                      <td>{amount.context}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Daty">
            {result.dates.length === 0 ? (
              <Empty />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Kontekst</th>
                  </tr>
                </thead>
                <tbody>
                  {result.dates.map((date, i) => (
                    <tr key={`${date.date}-${i}`}>
                      <td className="nowrap">{formatIsoDate(date.date)}</td>
                      <td>{date.context}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Organizacje">
            <TagList items={result.entities.organizations} />
          </Section>

          <Section title="Osoby">
            <TagList items={result.entities.people} />
          </Section>

          <Section title="Słowa kluczowe">
            <TagList items={result.keywords} />
          </Section>
        </div>
      ) : (
        <div id="panel-json" role="tabpanel" aria-labelledby="tab-json">
          <pre className="json" tabIndex={0} aria-label="Wynik w formacie JSON">
            {toJsonString(result)}
          </pre>
        </div>
      )}
    </article>
  )
}
