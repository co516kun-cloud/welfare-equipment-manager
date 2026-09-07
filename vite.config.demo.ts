import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

/**
 * デモモード用の Vite 設定（2026-09-07 追加）
 *
 * 目的: 本番の Supabase に一切つながずに UI を確認する。
 *
 * 通常の `npm run dev` は envDir が ~/secrets を指しており本番DBにつながる。
 * 画面を見るだけの確認でも実際の利用者名が表示されるため、スクリーンショットを
 * 残したり第三者に見せたりできない。UI の回帰確認にはそれで困る。
 *
 * ここでは環境変数を define で上書きする。URL に 'dummy' が入っていることが
 * アプリ側のスイッチになっており、2箇所が自動でモックに切り替わる:
 *   - src/hooks/useAuth.ts:16          → localStorage の auth_user を見る（本物のログイン不要）
 *   - src/lib/supabase-database.ts:18  → mock-database.ts（localStorage 上の作り物）を使う
 *
 * .env ファイルを置かないのは意図的（秘密ファイルと紛らわしいものを増やさないため）。
 *
 * 使い方:
 *   npm run dev:demo          … http://localhost:5199/ で起動
 *   node scripts/demo-check.mjs  … ヘッドレスブラウザで自動ログインして画面を撮る
 */
const DEMO_ENV: Record<string, string> = {
  VITE_SUPABASE_URL: 'https://dummy.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'dummy-anon-key-for-local-ui-check',
  VITE_WEATHER_API_KEY: '',
  VITE_WEATHER_LOCATION: 'Tokyo',
}

export default defineConfig(env =>
  mergeConfig(typeof base === 'function' ? base(env) : base, {
    define: Object.fromEntries(
      Object.entries(DEMO_ENV).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])
    ),
    server: {
      port: 5199,
      strictPort: false,
    },
  })
)
