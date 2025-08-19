# 福祉用具管理アプリ テストガイド

## 環境設定手順

### 1. Supabaseプロジェクトの準備
1. [Supabase](https://supabase.com)でプロジェクトを作成
2. SQL Editorで`create-supabase-tables.sql`を実行
3. Settings > APIから以下を取得：
   - Project URL
   - Anon Key

### 2. 環境変数の設定
`.env.example`を`.env`にコピーして、実際の値を設定：
```bash
cp .env.example .env
```

`.env`ファイルを編集：
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. アプリケーションの起動
```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## テスト項目

### 基本機能のテスト
1. **ログイン画面**
   - Supabase環境変数が設定されていない場合、デバッグモードで起動
   - 環境変数が設定されている場合、ログイン画面が表示

2. **在庫管理**
   - 商品一覧の表示
   - 商品の状態変更（available → rented → returned など）
   - QRコードスキャン機能

3. **発注管理**
   - 新規発注の作成
   - 発注ステータスの管理
   - 承認フロー

4. **準備タスク**
   - 清掃・メンテナンスタスクの管理
   - タスクの完了処理

## 既知の問題と修正が必要な箇所

### 1. 型定義の不整合
- `src/types/index.ts`: スネークケース（product_id）
- `src/lib/database.ts`: キャメルケース（productId）

### 2. TypeScript設定
- `tsconfig.app.json`: strict: false（型チェックが無効）

### 3. データベーススキーマの不一致
- LocalDatabaseとSupabaseのスキーマに差異がある可能性

## デバッグモード
環境変数が設定されていない場合、自動的にデバッグモードで起動します。
この場合、LocalStorageを使用したモックデータベースが使用されます。

## トラブルシューティング

### エラー: "Missing Supabase environment variables"
→ `.env`ファイルが正しく設定されているか確認

### エラー: "42P01: relation does not exist"
→ SQLスクリプトが正しく実行されているか確認

### アプリケーションが起動しない
→ `npm install`で依存関係をインストール
→ Node.jsのバージョンを確認（18.x以上推奨）