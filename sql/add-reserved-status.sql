-- product_itemsテーブルのstatusチェック制約を更新して'reserved'を追加
-- 既存の制約を削除して新しい制約を作成

-- 1. 既存の制約名を確認（通常は product_items_status_check）
-- 制約を削除
ALTER TABLE product_items 
DROP CONSTRAINT IF EXISTS product_items_status_check;

-- 2. 新しい制約を追加（reservedを含む）
ALTER TABLE product_items 
ADD CONSTRAINT product_items_status_check 
CHECK (status IN (
  'available', 
  'reserved',
  'ready_for_delivery', 
  'rented', 
  'returned', 
  'cleaning', 
  'maintenance', 
  'demo_cancelled', 
  'out_of_order', 
  'unknown'
));

-- 3. 確認メッセージ
SELECT '✅ 予約済み（reserved）ステータスが追加されました' as message;