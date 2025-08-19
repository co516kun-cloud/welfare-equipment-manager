-- シンプルなRLS設定（全テーブル対応）
-- エラーが発生した場合は、該当のテーブルが存在しない可能性があります

-- 【Step 1】全テーブルでRLSを有効化
DO $$
BEGIN
    -- 基本テーブル
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'categories') THEN
        ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'products') THEN
        ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'product_items') THEN
        ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'orders') THEN
        ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'order_items') THEN
        ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'item_histories') THEN
        ALTER TABLE public.item_histories ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'preparation_tasks') THEN
        ALTER TABLE public.preparation_tasks ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'demo_equipment') THEN
        ALTER TABLE public.demo_equipment ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'deposit_items') THEN
        ALTER TABLE public.deposit_items ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 【Step 2】認証ユーザー向けポリシーを作成

-- Categories
DROP POLICY IF EXISTS "authenticated_access_categories" ON public.categories;
CREATE POLICY "authenticated_access_categories" ON public.categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products
DROP POLICY IF EXISTS "authenticated_access_products" ON public.products;
CREATE POLICY "authenticated_access_products" ON public.products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product Items
DROP POLICY IF EXISTS "authenticated_access_product_items" ON public.product_items;
CREATE POLICY "authenticated_access_product_items" ON public.product_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Users
DROP POLICY IF EXISTS "authenticated_access_users" ON public.users;
CREATE POLICY "authenticated_access_users" ON public.users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Orders
DROP POLICY IF EXISTS "authenticated_access_orders" ON public.orders;
CREATE POLICY "authenticated_access_orders" ON public.orders
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Order Items
DROP POLICY IF EXISTS "authenticated_access_order_items" ON public.order_items;
CREATE POLICY "authenticated_access_order_items" ON public.order_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Item Histories
DROP POLICY IF EXISTS "authenticated_access_item_histories" ON public.item_histories;
CREATE POLICY "authenticated_access_item_histories" ON public.item_histories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Preparation Tasks
DROP POLICY IF EXISTS "authenticated_access_preparation_tasks" ON public.preparation_tasks;
CREATE POLICY "authenticated_access_preparation_tasks" ON public.preparation_tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Demo Equipment（既存のポリシーを置き換え）
DROP POLICY IF EXISTS "Enable read access for all users" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.demo_equipment;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.demo_equipment;
DROP POLICY IF EXISTS "authenticated_access_demo_equipment" ON public.demo_equipment;

CREATE POLICY "authenticated_access_demo_equipment" ON public.demo_equipment
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Deposit Items（既存のポリシーを置き換え）
DROP POLICY IF EXISTS "Enable read access for all users" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.deposit_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.deposit_items;
DROP POLICY IF EXISTS "authenticated_access_deposit_items" ON public.deposit_items;

CREATE POLICY "authenticated_access_deposit_items" ON public.deposit_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 完了メッセージ
SELECT 'RLS設定が完了しました。全テーブルで認証ユーザーのみアクセス可能です。' as message;