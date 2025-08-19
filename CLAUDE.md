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