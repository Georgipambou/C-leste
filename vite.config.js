import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
 
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if(id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
          if(id.includes('node_modules/@supabase')) return 'supabase';
          if(id.includes('node_modules/lucide-react')) return 'lucide';
          if(id.includes('node_modules/@ffmpeg')) return 'ffmpeg';
        }
      }
    }
  },
  plugins: [
    react(),
    compression(),
    VitePWA({
      registerType: 'autoUpdate',
      srcDir: 'public',
      filename: 'sw.js',
      strategies: 'injectManifest',
      injectManifest: {
        injectionPoint: undefined
      },
      manifest: {
        name: 'Céleste',
        short_name: 'Céleste',
        description: 'Exprime ta vraie personnalitée',
        theme_color: '#0A0705',
        background_color: '#0A0705',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      }
    })
  ]
})