import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    // Local dev only: the frontend is served by this Vite dev server
    // (`npm run dev`), while `vercel dev` runs the /api serverless functions on
    // :3000. This proxy forwards /api/* calls there, so we never route the
    // frontend through vercel dev's Vite integration (which breaks on Vite 8).
    // Harmless in production and on the teacher build (no /api routes exist there).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})