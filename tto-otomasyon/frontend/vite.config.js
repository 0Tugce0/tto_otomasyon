import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Tailwind CSS v4 — Vite plugin (@tailwindcss/vite)
    // v3'ten farklı: tailwind.config.js YOK, CSS içinde @import "tailwindcss"
    tailwindcss(),
  ],

  build: {
    // B-4 kararı: build çıktısı doğrudan backend/app/static/'e yazılır.
    // FastAPI bu dizini StaticFiles ile serve eder (main.py'deki mount).
    outDir: '../backend/app/static',
    emptyOutDir: true, // Eski build kalıntıları silinsin (outDir proje dışında olduğu için explicit gerekli)
  },

  server: {
    port: 5173,
    // Dev modunda /api isteklerini backend'e proxy'le.
    // Böylece dev'de CORS ayarına gerek kalmaz (aynı origin gibi davranır).
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
