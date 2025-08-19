-- 現在のアプリに必要な全テーブルの存在確認
-- このSQLを実行して、全テーブルが存在するか確認できます

SELECT 
    'テーブル存在確認' as check_type,
    '===================' as separator;

-- 1. 必須テーブルの存在確認
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'categories',
        'products', 
        'product_items',
        'users',
        'orders',
        'order_items',
        'item_histories',
        'preparation_tasks',
        'demo_equipment',
        'deposit_items'
    ]) as table_name
),
existing_tables AS (
    SELECT tablename as table_name
    FROM pg_tables 
    WHERE schemaname = 'public'
)
SELECT 
    rt.table_name,
    CASE 
        WHEN et.table_name IS NOT NULL THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status,
    CASE 
        WHEN et.table_name IS NOT NULL THEN 'OK'
        ELSE 'ERROR: テーブルが作成されていません'
    END as message
FROM required_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
ORDER BY rt.table_name;

-- 2. 各テーブルのレコード数確認
SELECT 
    '',
    'レコード数確認' as check_type,
    '===================' as separator;

DO $$
DECLARE
    table_record RECORD;
    table_count INTEGER;
    sql_query TEXT;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'categories', 'products', 'product_items', 'users', 
            'orders', 'order_items', 'item_histories', 'preparation_tasks',
            'demo_equipment', 'deposit_items'
          )
        ORDER BY tablename
    LOOP
        sql_query := 'SELECT COUNT(*) FROM ' || table_record.tablename;
        EXECUTE sql_query INTO table_count;
        
        RAISE NOTICE '% : % レコード', 
            RPAD(table_record.tablename, 20), 
            table_count;
    END LOOP;
END $$;

-- 3. RLS設定確認
SELECT 
    '',
    'RLS設定確認' as check_type,
    '===================' as separator;

SELECT 
    c.relname as table_name,
    CASE 
        WHEN c.relrowsecurity THEN '✅ 有効'
        ELSE '❌ 無効'
    END as rls_status,
    (SELECT count(*) 
     FROM pg_policies p 
     WHERE p.schemaname = 'public' 
       AND p.tablename = c.relname) as policy_count
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

-- 4. 不足テーブルがある場合の作成方法案内
SELECT 
    '',
    '不足テーブルがある場合' as notice,
    '===================' as separator,
    '以下のSQLファイルを確認してください：' as instruction;

SELECT 
    'create-base-tables.sql' as file_name,
    '基本テーブル (categories, products, product_items, users)' as description
UNION ALL
SELECT 
    'update-tables-for-orders.sql',
    '発注テーブル (orders, order_items)'
UNION ALL
SELECT 
    'create-item-histories-table.sql',
    '履歴テーブル (item_histories)'
UNION ALL
SELECT 
    'create-preparation-tasks-table.sql',
    '準備タスクテーブル (preparation_tasks)'
UNION ALL
SELECT 
    'sql/create-demo-equipment-table.sql',
    'デモ機テーブル (demo_equipment)'
UNION ALL
SELECT 
    'sql/create-deposit-items-table.sql',
    '預かり物テーブル (deposit_items)';

-- 5. 総合結果
SELECT 
    '',
    '総合確認結果' as final_check,
    '===================' as separator;

WITH table_check AS (
    SELECT 
        COUNT(*) as existing_count
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'categories', 'products', 'product_items', 'users', 
        'orders', 'order_items', 'item_histories', 'preparation_tasks',
        'demo_equipment', 'deposit_items'
      )
)
SELECT 
    CASE 
        WHEN existing_count = 10 THEN '🎉 全テーブル存在 - アプリ使用可能'
        ELSE '⚠️  不足テーブルあり: ' || (10 - existing_count) || '個のテーブルが不足'
    END as result,
    existing_count || ' / 10 テーブル' as details
FROM table_check;