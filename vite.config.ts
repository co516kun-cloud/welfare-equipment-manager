import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { homedir } from 'os'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  envDir: resolve(homedir(), 'secrets/welfare-equipment-manager'),
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
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
}))
