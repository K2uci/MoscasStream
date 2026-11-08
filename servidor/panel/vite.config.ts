import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, las llamadas a la API van al backend en el puerto 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
})
