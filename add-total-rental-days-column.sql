-- Add total_rental_days column to product_items table
-- This column stores the cumulative total of all rental periods for each item

-- Add the column (defaults to 0 for existing items)
ALTER TABLE product_items
ADD COLUMN IF NOT EXISTS total_rental_days INTEGER DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN product_items.total_rental_days IS '累積貸与日数: この商品の全ての貸与期間の合計日数。返却処理時に加算される。';

-- Update existing items to have 0 if NULL
UPDATE product_items
SET total_rental_days = 0
WHERE total_rental_days IS NULL;
