import { useEffect, useState } from 'react'

export type ProgressStep = 'reading' | 'analyzing'

const STEPS: { id: ProgressStep; label: string }[] = [
  { id: 'reading', label: 'Odczyt tekstu z PDF' },
  { id: 'analyzing', label: 'Analiza AI: podsumowanie i dane' },
]

interface ProgressStatusProps {
  fileName: string
  step: ProgressStep
}

export function ProgressStatus({ fileName, step }: ProgressStatusProps) {
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [startedAt])

  const currentIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <section className="panel progress" aria-busy="true">
      <div className="progress__header">
        <span className="spinner" aria-hidden="true" />
        <div>
          <p className="progress__file">{fileName}</p>
          <p className="muted" role="status" aria-live="polite">
            {STEPS[currentIndex]?.label}… ({elapsed} s)
          </p>
        </div>
      </div>
      <ol className="progress__steps">
        {STEPS.map((s, index) => (
          <li
            key={s.id}
            className={
              index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : undefined
            }
          >
            {s.label}
          </li>
        ))}
      </ol>
    </section>
  )
}
