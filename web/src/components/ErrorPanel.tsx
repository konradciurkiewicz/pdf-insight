import { useEffect, useRef } from 'react'

interface ErrorPanelProps {
  message: string
  onRetry?: () => void
  onReset: () => void
}

export function ErrorPanel({ message, onRetry, onReset }: ErrorPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Przeniesienie fokusu — użytkownik klawiatury/czytnika ekranu od razu trafia na błąd.
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <section className="panel panel--error" role="alert">
      <h2 ref={headingRef} tabIndex={-1}>
        Nie udało się przeanalizować dokumentu
      </h2>
      <p>{message}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="button button--primary" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
        <button type="button" className="button" onClick={onReset}>
          Wybierz inny plik
        </button>
      </div>
    </section>
  )
}
