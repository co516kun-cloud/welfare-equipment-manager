import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// テスト専用の設定。vite.config.ts は本番ビルド用なので触っていない。
// （envDir が ~/secrets を指しているため、テストでは Supabase 系をすべてモックする）
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // mcp-server 配下の純粋ロジック（印刷エージェント等）もここで回す
    include: ['src/**/*.test.{ts,tsx}', 'mcp-server/src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
