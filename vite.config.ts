import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ttsMiddleware } from './scripts/edge-tts.mjs'

// Reads player names with Edge TTS while developing; when deployed, api/tts.py does the same job.
const tts = ttsMiddleware('node_modules/.cache/ma-soi-tts')

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'tts-api',
      configureServer: (server) => void server.middlewares.use('/api/tts', tts),
      configurePreviewServer: (server) => void server.middlewares.use('/api/tts', tts),
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ma Sói – Quản trò tự động',
        short_name: 'Ma Sói',
        description: 'Ứng dụng quản trò Ma Sói tự động, đọc lời dẫn bằng tiếng Việt',
        lang: 'vi',
        start_url: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1326',
        theme_color: '#1a1326',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Voice clips are precached too, so narration works offline.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3}'] },
    }),
  ],
})
