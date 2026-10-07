import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base matches the GitHub Pages path: https://bsav0016.github.io/Tax-Projection/
export default defineConfig({
  base: '/Tax-Projection/',
  plugins: [react()],
})
