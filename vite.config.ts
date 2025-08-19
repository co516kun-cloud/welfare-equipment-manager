import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      clientPort: 5173,
    },
    cors: true,
  },
})
