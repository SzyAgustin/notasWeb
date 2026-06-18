import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages sirve el repo en /notasWeb/, no en la raíz del dominio.
  base: '/notasWeb/',
})
