import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serwuje aplikację pod https://<user>.github.io/<repo>/ — stąd `base`.
export default defineConfig({
  base: '/pdf-insight/',
  plugins: [react()],
})
