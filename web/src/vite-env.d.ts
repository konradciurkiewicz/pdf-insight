/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adres Workera, np. https://pdf-insight-api.<konto>.workers.dev (bez końcowego „/”). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
