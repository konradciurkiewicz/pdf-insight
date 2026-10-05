import { useId, useRef, useState, type DragEvent } from 'react'

interface DropZoneProps {
  onFile: (file: File) => void
  disabled?: boolean
}

export function DropZone({ onFile, disabled = false }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const hintId = useId()

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  return (
    <div
      className={`dropzone${isDragging ? ' dropzone--active' : ''}${disabled ? ' dropzone--disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <svg className="dropzone__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="dropzone__title">Przeciągnij i upuść plik PDF</p>
      <p className="dropzone__hint" id={hintId}>
        lub wybierz go z dysku · tylko PDF · maks.&nbsp;10&nbsp;MB
      </p>
      <button
        type="button"
        className="button button--primary"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={(event) => {
          // Kliknięcie obsługuje już kontener — nie otwieramy okna wyboru dwa razy.
          event.stopPropagation()
          inputRef.current?.click()
        }}
      >
        Wybierz plik
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset, żeby ponowny wybór tego samego pliku też wywołał onChange.
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </div>
  )
}
