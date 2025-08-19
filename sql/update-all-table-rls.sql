-- 全テーブルのRLS（Row Level Security）設定の更新
-- 新しく追加されたテーブルと既存テーブルの統一設定

-- 【Step 1】全テーブルでRLSを有効化
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_items ENABLE ROW LEVEL SECURITY;

-- 【Step 2】既存の一時的なポリシーをクリーンアップ（存在する場合のみ）
DROP POLICY IF EXISTS "temporary_access_categories" ON public.categories;
DROP POLICY IF EXISTS "temporary_access_products" ON public.products;
DROP POLICY IF EXISTS "temporary_access_product_items" ON public.product_items;
DROP POLICY IF EXISTS "temporary_access_users" ON public.users;
DROP POLICY IF EXISTS "temporary_access_orders" ON public.orders;
DROP POLICY IF EXISTS "temporary_access_order_items" ON public.order_items;
DROP POLICY IF EXISTS "temporary_access_item_histories" ON public.item_histories;
DROP POLICY IF EXISTS "temporary_access_preparation_tasks" ON public.preparation_tasks;

-- 【Step 3】統一された認証ベースのポリシーを作成

-- Categories テーブル
DROP POLICY IF EXISTS "authenticated_access_categories" ON public.categories;
CREATE POLICY "authenticated_access_categories" ON public.categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products テーブル
DROP POLICY IF EXISTS "authenticated_access_products" ON public.products;
CREATE POLICY "authenticated_access_products" ON public.products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product Items テーブル
DROP POLICY IF EXISTS "authenticated_access_product_items" ON public.product_items;
CREATE POLICY "authenticated_access_product_items" ON public.product_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Users テーブル
DROP POLICY IF EXISTS "authenticated_access_users" ON public.users;
CREATE POLICY "authenticated_access_users" ON public.users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Orders テーブル
DROP POLICY IF EXISTS "authenticated_access_orders" ON public.orders;
CREATE POLICY "authenticated_access_orders" ON public.orders
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Order Items テーブル
DROP POLICY IF EXISTS "authenticated_access_order_items" ON public.order_items;
CREATE POLICY "authenticated_access_order_items" ON public.order_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Item Histories テーブル
DROP POLICY IF EXISTS "authenticated_access_item_histories" ON public.item_histories;
CREATE POLICY "authenticated_access_item_histories" ON public.item_histories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Preparation Tasks テーブル
DROP POLICY IF EXISTS "authenticated_access_preparation_tasks" ON public.preparation_tasks;
CREATE POLICY "authenticated_access_preparation_tasks" ON public.preparation_tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Demo Equipment テーブル（既に設定済みの場合は置き換え）
DROP POLICY IF EXISTS "Enable read access for all users" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.demo_equipment;

CREATE POLICY "authenticated_access_demo_equipment" ON public.demo_equipment
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Deposit Items テーブル（既に設定済みの場合は置き換え）
DROP POLICY IF EXISTS "Enable read access for all users" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.deposit_items;

CREATE POLICY "authenticated_access_deposit_items" ON public.deposit_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 【Step 4】権限確認用のビュー作成（オプション）
-- このビューで各テーブルのRLS状態を確認できます
CREATE OR REPLACE VIEW rls_status AS
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    (SELECT count(*) FROM pg_policies WHERE schemaname = n.nspname AND tablename = c.relname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
  AND c.relname IN (
    'categories', 'products', 'product_items', 'users', 
    'orders', 'order_items', 'item_histories', 'preparation_tasks',
    'demo_equipment', 'deposit_items'
  )
ORDER BY c.relname;

-- 実行完了メッセージ
-- 以下のクエリを実行してRLS状態を確認できます：
-- SELECT * FROM rls_status;