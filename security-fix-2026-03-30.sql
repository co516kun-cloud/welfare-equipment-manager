-- ============================================================
-- セキュリティ修正SQL: 全テーブルのRLSポリシー統一
-- 作成日: 2026-03-30
-- ============================================================
--
-- 【このSQLが行うこと】
-- 1. 全11テーブルのRLSを有効化（既に有効なら変更なし）
-- 2. 既存のポリシーを全て削除（allow_all_*, temporary_access_*,
--    Enable *, authenticated_access_* 等すべて）
-- 3. 全テーブルに統一された「TO authenticated」ポリシーを作成
--    → 認証済みユーザーのみアクセス可能（匿名アクセスを完全遮断）
--
-- 【実行前に確認すべきこと】
-- 1. アプリがSupabase Auth（メール/パスワード等）で認証していること
--    → anon keyだけで接続していると、全テーブルにアクセスできなくなる
-- 2. Supabase SQL Editorで実行すること（service_roleで実行される）
-- 3. 実行後、アプリの全機能（商品一覧、注文、ラベル印刷等）が
--    正常に動作するかテストすること
-- 4. 問題が発生した場合、最下部のロールバックSQLで元に戻せる
--
-- 【対象テーブル（全11テーブル）】
-- categories, products, product_items, users, orders,
-- order_items, item_histories, preparation_tasks,
-- demo_equipment, deposit_items, label_print_queue
-- ============================================================

BEGIN;

-- ============================================================
-- Step 1: 全テーブルでRLSを有効化
-- ============================================================

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
ALTER TABLE public.label_print_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 2: 既存ポリシーを全て削除
-- ============================================================

-- --- categories ---
DROP POLICY IF EXISTS "allow_all_categories" ON public.categories;
DROP POLICY IF EXISTS "temporary_access_categories" ON public.categories;
DROP POLICY IF EXISTS "authenticated_access_categories" ON public.categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.categories;

-- --- products ---
DROP POLICY IF EXISTS "allow_all_products" ON public.products;
DROP POLICY IF EXISTS "temporary_access_products" ON public.products;
DROP POLICY IF EXISTS "authenticated_access_products" ON public.products;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;

-- --- product_items ---
DROP POLICY IF EXISTS "allow_all_product_items" ON public.product_items;
DROP POLICY IF EXISTS "temporary_access_product_items" ON public.product_items;
DROP POLICY IF EXISTS "authenticated_access_product_items" ON public.product_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.product_items;

-- --- users ---
DROP POLICY IF EXISTS "allow_all_users" ON public.users;
DROP POLICY IF EXISTS "temporary_access_users" ON public.users;
DROP POLICY IF EXISTS "authenticated_access_users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;

-- --- orders ---
DROP POLICY IF EXISTS "allow_all_orders" ON public.orders;
DROP POLICY IF EXISTS "temporary_access_orders" ON public.orders;
DROP POLICY IF EXISTS "authenticated_access_orders" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;

-- --- order_items ---
DROP POLICY IF EXISTS "allow_all_order_items" ON public.order_items;
DROP POLICY IF EXISTS "temporary_access_order_items" ON public.order_items;
DROP POLICY IF EXISTS "authenticated_access_order_items" ON public.order_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.order_items;

-- --- item_histories ---
DROP POLICY IF EXISTS "allow_all_item_histories" ON public.item_histories;
DROP POLICY IF EXISTS "temporary_access_item_histories" ON public.item_histories;
DROP POLICY IF EXISTS "authenticated_access_item_histories" ON public.item_histories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.item_histories;

-- --- preparation_tasks ---
DROP POLICY IF EXISTS "allow_all_preparation_tasks" ON public.preparation_tasks;
DROP POLICY IF EXISTS "temporary_access_preparation_tasks" ON public.preparation_tasks;
DROP POLICY IF EXISTS "authenticated_access_preparation_tasks" ON public.preparation_tasks;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.preparation_tasks;

-- --- demo_equipment ---
DROP POLICY IF EXISTS "allow_all_demo_equipment" ON public.demo_equipment;
DROP POLICY IF EXISTS "temporary_access_demo_equipment" ON public.demo_equipment;
DROP POLICY IF EXISTS "authenticated_access_demo_equipment" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.demo_equipment;

-- --- deposit_items ---
DROP POLICY IF EXISTS "allow_all_deposit_items" ON public.deposit_items;
DROP POLICY IF EXISTS "temporary_access_deposit_items" ON public.deposit_items;
DROP POLICY IF EXISTS "authenticated_access_deposit_items" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.deposit_items;

-- --- label_print_queue ---
DROP POLICY IF EXISTS "allow_all_label_print_queue" ON public.label_print_queue;
DROP POLICY IF EXISTS "temporary_access_label_print_queue" ON public.label_print_queue;
DROP POLICY IF EXISTS "authenticated_access_label_print_queue" ON public.label_print_queue;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.label_print_queue;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.label_print_queue;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.label_print_queue;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.label_print_queue;

-- ============================================================
-- Step 3: 統一ポリシーを作成（全テーブル TO authenticated）
-- ============================================================

CREATE POLICY "authenticated_full_access" ON public.categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.product_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.orders
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.order_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.item_histories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.preparation_tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.demo_equipment
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.deposit_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.label_print_queue
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================
-- 確認クエリ（実行後にこれを実行して結果を確認）
-- ============================================================

SELECT
    c.relname AS table_name,
    CASE WHEN c.relrowsecurity THEN 'RLS有効' ELSE 'RLS無効' END AS rls_status,
    (SELECT count(*) FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count,
    (SELECT string_agg(p.policyname, ', ')
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_names
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'categories', 'products', 'product_items', 'users',
    'orders', 'order_items', 'item_histories', 'preparation_tasks',
    'demo_equipment', 'deposit_items', 'label_print_queue'
  )
ORDER BY c.relname;

-- ============================================================
-- ロールバック（問題が発生した場合、以下を実行して元に戻す）
-- ※ 元の状態（allow_all_* = anon含む全公開）に戻るため、
--   一時的な復旧用。速やかに原因を調査すること。
-- ============================================================
/*
-- ロールバック: 全テーブルで全公開ポリシーに戻す（緊急用）
BEGIN;

DROP POLICY IF EXISTS "authenticated_full_access" ON public.categories;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.products;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.product_items;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.users;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.orders;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.order_items;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.item_histories;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.preparation_tasks;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.demo_equipment;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.deposit_items;
DROP POLICY IF EXISTS "authenticated_full_access" ON public.label_print_queue;

CREATE POLICY "allow_all" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.product_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.item_histories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.preparation_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.demo_equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.deposit_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.label_print_queue FOR ALL USING (true) WITH CHECK (true);

COMMIT;
*/
