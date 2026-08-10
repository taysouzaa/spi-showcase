/**
 * Configuração do Vite para o frontend SPI.
 * Ajusta base de build para hospedagem em subpasta e registra plugins de React/Tailwind.
 */
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
