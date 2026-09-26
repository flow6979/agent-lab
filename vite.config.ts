import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages pe site https://flow6979.github.io/agent-lab/ pe chalti hai, isliye base path.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/agent-lab/',
  plugins: [react()],
})
