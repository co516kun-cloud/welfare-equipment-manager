-- 【Step 2】セキュリティ強化：認証ユーザーのみアクセス可能にする
-- Step 1実行後、アプリケーションが正常に動作することを確認してからこのSQLを実行

-- 1. 一時的なポリシーを削除
DROP POLICY IF EXISTS "temporary_access_categories" ON public.categories;
DROP POLICY IF EXISTS "temporary_access_products" ON public.products;
DROP POLICY IF EXISTS "temporary_access_product_items" ON public.product_items;
DROP POLICY IF EXISTS "temporary_access_users" ON public.users;
DROP POLICY IF EXISTS "temporary_access_orders" ON public.orders;
DROP POLICY IF EXISTS "temporary_access_order_items" ON public.order_items;
DROP POLICY IF EXISTS "temporary_access_item_histories" ON public.item_histories;

-- 2. 認証ユーザーのみアクセス可能なポリシーを作成
CREATE POLICY "authenticated_access_categories" ON public.categories
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_access_products" ON public.products
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_access_product_items" ON public.product_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_access_users" ON public.users
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_access_orders" ON public.orders
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_access_order_items" ON public.order_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_access_item_histories" ON public.item_histories
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 実行後は認証されたユーザーのみがデータにアクセス可能になります