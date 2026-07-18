import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devHttps = env.VITE_DEV_HTTPS === 'true'

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(devHttps ? [basicSsl()] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon_.svg', 'favicon-marghot.svg', 'notification-click.js'],
        manifest: {
          name: 'Mi Bodega — Panel',
          short_name: 'Mi Bodega',
          description: 'Gestión de bodega y alertas de pedidos web MARGHOT',
          theme_color: '#0f766e',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/pos',
          icons: [
            {
              src: 'favicon_.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          importScripts: ['notification-click.js'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
    },
  }
})
