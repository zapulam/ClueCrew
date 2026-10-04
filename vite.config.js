import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/ClueCrew/',   // must match the repo name
  plugins: [
    react(),
    tailwindcss(),
  ],
})