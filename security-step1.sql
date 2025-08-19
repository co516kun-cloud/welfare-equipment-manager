-- 【Step 1】緊急修正：RLS（Row Level Security）を有効化
-- このSQLをSupabaseのSQL Editorで実行してください

-- 1. 全テーブルでRLSを有効化（セキュリティ警告を修正）
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- もし以下のテーブルがある場合も有効化
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_histories ENABLE ROW LEVEL SECURITY;

-- 2. 一時的なポリシー（アプリが動くようにするため）
-- ⚠️ この時点では、まだ誰でもアクセス可能です

CREATE POLICY "temporary_access_categories" ON public.categories
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "temporary_access_products" ON public.products
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "temporary_access_product_items" ON public.product_items
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "temporary_access_users" ON public.users
FOR ALL USING (true) WITH CHECK (true);

-- 追加テーブルのポリシー（存在する場合）
CREATE POLICY "temporary_access_orders" ON public.orders
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "temporary_access_order_items" ON public.order_items
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "temporary_access_item_histories" ON public.item_histories
FOR ALL USING (true) WITH CHECK (true);

-- 実行後は「Success. No rows returned」と表示されればOK