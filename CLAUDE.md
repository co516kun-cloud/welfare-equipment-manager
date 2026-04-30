# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

福祉用具貸与事業所の商品管理アプリケーション - 福祉用具の在庫管理、貸与・返却・メンテナンスフローを QR コード スキャンで管理するモダンな SPA アプリケーション。

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + カスタムデザインシステム
- **UI Components**: shadcn/ui ベースのカスタムコンポーネント
- **Architecture**: SPA (Single Page Application)

## Project Structure

```
welfare-equipment-manager/
├── src/
│   ├── components/
│   │   └── ui/          # 再利用可能なUIコンポーネント
│   ├── lib/
│   │   └── utils.ts     # ユーティリティ関数
│   ├── App.tsx          # メインアプリケーション
│   └── index.css        # Tailwind CSS + カスタムスタイル
├── public/
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── vite.config.ts
```

## Development Commands

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview

# 型チェック
npm run type-check

# リンター
npm run lint
```

## Core Features Architecture

### 主要機能フロー
1. **商品登録**: 個別管理番号付きで商品をシステムに登録
2. **QR コード管理**: 各商品に QR コード生成・スキャン機能
3. **ステータス管理**: 貸与 → 返却 → 消毒済み → メンテナンス済み → 入庫
4. **在庫管理**: リアルタイムでの在庫状況追跡
5. **発注管理**: 在庫不足時の自動発注アラート

### UI/UX デザインパターン
- **ダッシュボード**: 統計カード + クイックアクション + 最近のアクティビティ
- **カラーシステム**: CSS variables による統一されたデザイントークン
- **レスポンシブデザイン**: モバイルファーストアプローチ
- **アクセシビリティ**: ARIA 対応とキーボードナビゲーション

## Component Architecture

### UI コンポーネント
- `Button`: 複数バリアントとサイズ対応
- `cn()`: clsx + tailwind-merge によるクラス名統合ユーティリティ

### 今後追加予定
- QR Scanner コンポーネント
- データテーブル
- フォーム要素
- モーダル/ダイアログ
- ナビゲーションルーティング

## Development Notes

- esbuild に問題がある可能性があるため、依存関係のインストール時は注意が必要
- CSS variables を使用したテーマシステムでダークモード対応
- TypeScript strict mode で型安全性を保証
- 日本語UI/UX に最適化された設計

## Safety Rules (Claude Code 必読)

このプロジェクトは Supabase 本番DB・Vercel本番環境・実顧客データに接続している。以下を厳守すること。

### 禁止コマンド (settings.local.json の deny でも強制ブロック済み)
- `rm -rf` 系すべて — ディレクトリ一括削除は人間に依頼する
- `git push --force` / `--force-with-lease` / `-f` — main への強制 push 禁止
- `git reset --hard` / `git clean -f*` / `git checkout .` — 未コミット変更を破壊する操作
- `psql` 直接実行 / `supabase db reset` / `supabase db push` — 本番DB操作は手動のみ
- `vercel --prod` 系 — 本番デプロイは人間が確認後に実行

### SQL ファイルの扱い
- リポジトリ直下の `*.sql` ファイル (add-*.sql / fix-*.sql / create-*.sql 等 31本) は**実行履歴ではなくマイグレーション草稿**
- Claude が勝手に Supabase に流してはいけない。必要時はユーザーに「このSQLを Supabase ダッシュボードで流してください」と提示する形で渡す
- `DROP TABLE` / `DELETE FROM` / `TRUNCATE` を含む SQL を新規作成する場合は、必ず WHERE 条件と影響範囲を明記しユーザーに確認を取る

### 機密情報
- **`.env` の保管場所はリポジトリ外**: `~/secrets/welfare-equipment-manager/.env` (および `.env.local`)
- Vite はこの場所から読み込む (`vite.config.ts` の `envDir` で設定済み)
- プロジェクト直下に `.env` を作らないこと。テンプレートは `.env.example` のみ
- `.env` / `.env.local` / `.env.production` は Read/Edit/Write 全て deny 済み (相対・絶対・glob・bash経由すべて)
- `~/secrets/**` も deny 済み — Claude からは見えない
- Supabase URL/Anonキー、WeatherAPIキーが含まれるため、内容を会話に出さない・コミットしない・git add しない

### 新規開発者のセットアップ
1. `mkdir -p ~/secrets/welfare-equipment-manager && chmod 700 ~/secrets`
2. `.env.example` を参考に `~/secrets/welfare-equipment-manager/.env` を作成 (実値で)
3. `npm run dev` で起動確認

### 変更の検証
- `src/` 配下の変更はコミット前に `npm run type-check` と `npm run lint` を通す
- UI 変更はユーザーに動作確認を依頼してからコミット・デプロイへ進む
- 本番ユーザー (顧客名簿・貸与履歴) に影響しうる変更は必ず事前確認