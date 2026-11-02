# CLAUDE.md

福祉用具貸与事業所の商品管理アプリ。1 台ごとに QR コードを貼り、貸与 → 返却 → 消毒 → メンテナンス → 入庫の流れをスキャンで追う。在庫・発注・ラベル印刷も扱う。

**本番稼働中。** Supabase 本番 DB・Vercel・実顧客データにつながっていて、`main` への push がそのまま本番デプロイになる。リポジトリは **public**。

## 構成

| 場所 | 中身 |
|---|---|
| `src/` | React 18 + TypeScript + Vite の SPA。Tailwind、zustand、react-router-dom、Supabase JS、recharts、qr-scanner |
| `mcp-server/` | 在庫を読み書きする MCP サーバー（stdio）。Claude や Slack リスナーの口。ラベル印刷エージェント（`src/print-agent/`）も同居。別 package で `cd mcp-server && npm run build` |
| `scripts/` | Playwright の E2E（`*-e2e.mjs`）、デモ画面の自動撮影（`demo-check.mjs`）、履歴の補正（`backfill-used-intake.mjs`）、型チェックのゲート（`typecheck/`）、印刷エージェントの Windows 側（`print-agent/`） |
| `*.sql`（直下）と `sql/` | マイグレーションの**草稿**。実行履歴ではない（→ 下の「SQL ファイルの扱い」） |
| `docs/` | 設計書・記録 |

### src の中で迷ったら

| ファイル | 役割 |
|---|---|
| `src/App.tsx` | ルート定義。`src/pages/` の 1 ファイルが 1 画面 |
| `src/lib/item-status.ts` | **ステータス遷移表の正**（`STATUS_LABEL` / `getAvailableActions` / `needsUsedIntake`）。新しいステータスや操作はまずここ |
| `src/lib/supabase-database.ts` | DB アクセスの集約。URL に `dummy` が入っていると `mock-database.ts`（localStorage）に切り替わる |
| `src/lib/supabase.ts` | クライアント。`./auth-redirect` を createClient より先に import する順序に意味がある |
| `src/hooks/useAuth.ts` | ログイン状態。`dummy` URL ならモック |
| `src/stores/` | zustand（在庫・通知） |
| `src/types/index.ts` | DB 行の型。`ProductItem['status']` が ItemStatus |

## コマンド

```bash
npm run dev                   # 開発サーバー。⚠️ 本番 DB につながる（画面に実顧客名が出る）
npm run dev:demo              # 本番に触らずモックで UI を確認（http://localhost:5199）
node scripts/demo-check.mjs   # dev:demo 起動中に、自動ログインして主要画面を撮る
npm test                      # vitest。jsdom の起動込みで約 90 秒。mcp-server と scripts のテストも含む
npm run type-check            # 新規の型エラーだけ止めるゲート（既存分は scripts/typecheck/baseline.txt で据え置き）
npm run type-check:all        # 型エラーを全部見る
npm run type-check:accept     # 直した分をベースラインに反映
npm run lint                  # 既存エラーが多い。「自分の変更で増やしていないか」を差分で見る
npm run build                 # 本番ビルド。console / debugger は落とされる
cd mcp-server && npm run build   # shared/item-status.ts を再生成してから tsc
```

## 変更の流儀

- 会話・コミットメッセージ・コード内コメントは日本語。コミットは `type(scope): 何をどうしたか`（例 `fix(camera): 読み取り範囲を絞りすぎていたのを戻した`）
- `src/` を触ったらコミット前に `npm run type-check` と `npm test`
- UI 変更は田口さんに画面を見てもらってからコミット・デプロイ。「デプロイまでやって」と言われたら、テスト → ビルド → コミット → push（ここだけ確認が入る）→ 本番でバンドル名 `assets/index-<hash>.js` が変わったのを確認、まで通す
- 顧客名簿・貸与履歴に影響しうる変更は事前に確認を取る
- 設計書は `docs/` に。Claude 側の記憶は `~/.claude/projects/.../memory/`。この CLAUDE.md には「コードを読めば分かること」を書かず、罠と決まりだけ書く

## 罠（知らないと踏む）

- **ステータス遷移は 1 か所。** `src/lib/item-status.ts` が正。`mcp-server/src/shared/item-status.ts` は `npm run build` が生成する写しで、直接編集しない（2026-08 に同じ switch が 2 か所にあってずれた事故の再発防止）
- **型チェックゲートの誤判定。** 新しいファイルに `'unknown'` など ItemStatus と同じ文字列リテラルを書くと tsc のユニオン表示順が変わり、「解消 N 件・新規 N 件」が同数で出て exit 1 になる。別の語に変えるのが最小の回避
- **中古の新規登録。** 状態メモに「新品」が無い新規登録は中古扱いで、消毒完了 → メンテナンス完了 → 入庫処理の履歴 3 行を自動で足す（`needsUsedIntake`）。アプリと MCP の両方がこれを共有する
- **本番ビルドは console を落とす**（`vite.config.ts` の `esbuild.drop`）。本番で console.log を頼りに調べられない
- **CSP。** 外部ホストを足すときは `vercel.json` の `connect-src` も直す。いまは Supabase と weatherapi だけ
- **TypeScript は strict:false**（`tsconfig.app.json`）。詳細は `scripts/typecheck/gate.mjs` の先頭コメント
- **Supabase。** signup 無効・メールログインのみ。RLS は全テーブル authenticated 全許可で、ロール認可は無い（匿名は全ブロック）

## Safety Rules (Claude Code 必読)

このプロジェクトは Supabase 本番DB・Vercel本番環境・実顧客データに接続している。以下を厳守すること。

### 権限の3段階 (.claude/settings.json で設定。.claude/ は gitignore なのでこの PC 専用)
- **deny**（Claude は実行できない。人間が手で行う）: 下の禁止コマンドと、`.env` / `~/secrets` の読み書き
- **ask**（Claude は実行前に確認する）: `git push`、`git reset --hard` / `git clean` / `git checkout .` / `git restore .` / `git branch -D`、一時領域以外への `rm -r`（`~/.claude/hooks/safety-guard.py` が判定。node_modules / dist / build / tmp 配下は通る）、`vercel` / `npx vercel`、Supabase CLI の本番操作（`db` / `migration up` / `functions deploy` / `secrets`）、`gh pr merge`、`sudo`、第三者に届く MCP 送信（メール送信・Slack 投稿・カレンダー招待・Drive 共有）、Vercel MCP の書き込み系（デプロイ・promote・rollback・環境変数・ドメイン・課金）
- **allow**（それ以外すべて。確認なしで実行してよい）: Bash 全般（`pkill` / `supabase link` 含む）、ファイル編集、参照系 MCP、ブラウザ操作、Notion への書き込み、Gmail の下書き作成
- **迷ったら聞かずに進める。** 止まるのは push・本番 DB・秘密ファイルの 3 つだけ（田口さんの指示。2026-09-07）

### 禁止コマンド (.claude/settings.json の deny と ~/.claude/hooks/safety-guard.py で強制ブロック済み)
- `git push --force` / `--force-with-lease` / `-f` — main への強制 push 禁止
- `rm -rf /` / `rm -rf ~` — ルート・ホーム直下の再帰削除
- `psql` 直接実行 / `supabase db reset` / `supabase db push` / `supabase projects delete` — 本番DB操作は手動のみ
- `DROP TABLE` / `TRUNCATE` / WHERE 無しの `DELETE` を含むコマンド — 復元できない
- `vercel --prod` 系 / `gh repo delete` — 本番デプロイ・リポジトリ削除は人間が確認後に実行

### SQL ファイルの扱い
- リポジトリ直下と `sql/` の `*.sql`（add-* / fix-* / create-* / security-* 等）は**実行履歴ではなくマイグレーション草稿**。本番に何が当たっているかは Supabase ダッシュボードが正
- Claude が勝手に Supabase に流してはいけない。必要時はユーザーに「このSQLを Supabase ダッシュボードで流してください」と提示する形で渡す
- `DROP TABLE` / `DELETE FROM` / `TRUNCATE` を含む SQL を新規作成する場合は、必ず WHERE 条件と影響範囲を明記しユーザーに確認を取る

### 機密情報
- **`.env` の保管場所はリポジトリ外**: `~/secrets/welfare-equipment-manager/.env` (および `.env.local`)
- Vite と mcp-server はこの場所から読み込む (`vite.config.ts` の `envDir`、`mcp-server/src/env.ts`)
- プロジェクト直下に `.env` を作らないこと。テンプレートは `.env.example` のみ
- `.env` 系と `~/secrets/**` は Read / Edit が deny 済み。Bash は `.claude/hooks/env-guard.py`（PreToolUse）が、コマンド文字列のどこかで `.env` 系や `~/secrets` を名指ししていたら止める（`cat -- .env` / `base64 .env` / `node -e "...('.env')"` も止まる。`.env.example` と文章中の「.env」は通る）
- Vercel の環境変数の値（`get_project_env` 等）も同じ秘密。ask にしてある
- Supabase URL/Anonキー、WeatherAPIキー、印刷エージェントのログイン情報が含まれるため、内容を会話に出さない・コミットしない・git add しない
- **リポジトリは public。** 顧客名・内部 URL・鍵をコミットしない。`.claude/` は gitignore（ただし初回コミットの履歴には残っている）。デモ画面の撮影は `dev:demo` で（本番データが写り込まない）

### 新規開発者のセットアップ
1. `mkdir -p ~/secrets/welfare-equipment-manager && chmod 700 ~/secrets`
2. `.env.example` を参考に `~/secrets/welfare-equipment-manager/.env` を作成 (実値で)
3. `npm run dev` で起動確認（本番 DB につながる。画面だけ見たいなら `npm run dev:demo`）