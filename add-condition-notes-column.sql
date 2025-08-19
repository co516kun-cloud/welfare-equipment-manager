-- Add condition_notes column to product_items table and update item_histories table
-- This script adds the condition_notes column for maintenance and storage status notes

-- 1. Add condition_notes column to product_items table
ALTER TABLE product_items 
ADD COLUMN IF NOT EXISTS condition_notes TEXT;

-- 2. Add condition_notes column to item_histories table  
ALTER TABLE item_histories 
ADD COLUMN IF NOT EXISTS condition_notes TEXT;

-- 3. Remove the old notes column from product_items (optional - can be done later)
-- Note: Commenting out for now to preserve existing data
-- ALTER TABLE product_items DROP COLUMN IF EXISTS notes;

-- 4. Comment on the new columns
COMMENT ON COLUMN product_items.condition_notes IS 'Status notes for maintenance and storage processes (recorded)';
COMMENT ON COLUMN item_histories.condition_notes IS 'Status notes recorded in history for maintenance and storage processes';

-- 5. Create index for better performance on condition_notes searches
CREATE INDEX IF NOT EXISTS idx_product_items_condition_notes ON product_items(condition_notes) 
WHERE condition_notes IS NOT NULL;

-- 6. Update status constraint to include ready_for_delivery (if not already present)
ALTER TABLE product_items 
DROP CONSTRAINT IF EXISTS product_items_status_check;

ALTER TABLE product_items 
ADD CONSTRAINT product_items_status_check 
CHECK (status IN ('available', 'ready_for_delivery', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown'));

-- Status definitions:
-- available: 利用可能
-- ready_for_delivery: 配送準備完了 
-- rented: 貸与中  
-- returned: 返却済み
-- cleaning: 消毒済み
-- maintenance: メンテナンス済み
-- demo_cancelled: デモキャンセル
-- out_of_order: 故障中
-- unknown: 不明