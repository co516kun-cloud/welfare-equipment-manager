# セキュリティ設定ガイド

## 🛡️ Supabase セキュリティ設定

### 必須: Row Level Security (RLS) の有効化

本番環境では以下のSQLをSupabaseダッシュボードで実行してください：

```sql
-- 1. 全テーブルでRLSを有効化
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 2. 基本的な読み取り・書き込みポリシー (認証ユーザーのみ)
-- categories
CREATE POLICY "authenticated_users_all_categories" ON categories
FOR ALL USING (auth.role() = 'authenticated');

-- products
CREATE POLICY "authenticated_users_all_products" ON products
FOR ALL USING (auth.role() = 'authenticated');

-- product_items
CREATE POLICY "authenticated_users_all_product_items" ON product_items
FOR ALL USING (auth.role() = 'authenticated');

-- users
CREATE POLICY "authenticated_users_all_users" ON users
FOR ALL USING (auth.role() = 'authenticated');

-- orders
CREATE POLICY "authenticated_users_all_orders" ON orders
FOR ALL USING (auth.role() = 'authenticated');

-- order_items
CREATE POLICY "authenticated_users_all_order_items" ON order_items
FOR ALL USING (auth.role() = 'authenticated');
```

### 環境変数の管理

1. **開発環境**: `.env`ファイルに実際の値を設定
2. **本番環境**: Vercelの環境変数に設定
3. **重要**: `.env`ファイルは絶対にGitにコミットしない

### Vercel環境変数設定

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 🔐 追加セキュリティ対策

### Supabaseダッシュボード設定

1. **Authentication**: 必要に応じてユーザー認証を有効化
2. **API Settings**: 不要なAPIエンドポイントを無効化
3. **Database**: 直接SQL実行を制限
4. **Edge Functions**: サーバーサイド処理を分離

### アプリケーションレベル

- ユーザー入力の検証
- SQLインジェクション対策（Supabaseが自動対応）
- XSS対策（ReactのデフォルトでEscape）

## ⚠️ 重要な注意事項

1. `VITE_`で始まる環境変数はクライアントサイドで公開される
2. 機密データは絶対に`VITE_`変数に入れない
3. Anon Keyは公開されても安全（RLSで保護）
4. Service Role Keyは絶対にクライアントサイドで使用しない