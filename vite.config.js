import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SOCKET_SERVER_URL': JSON.stringify(process.env.VITE_SOCKET_SERVER_URL || 'https://vibetune-production.up.railway.app'),
    global: 'globalThis'
  },
  resolve: {
    alias: {
      events: 'events',
      util: 'util'
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
