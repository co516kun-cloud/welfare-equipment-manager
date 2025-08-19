-- Fix existing product_items data before updating constraints
-- This script updates existing condition values to match the new constraint

-- First, let's see what condition values currently exist
-- (Run this separately to check current data)
-- SELECT DISTINCT condition FROM product_items;
-- SELECT DISTINCT condition FROM item_histories WHERE condition IS NOT NULL;

-- Step 1: Update existing 'excellent' values to 'good' in product_items
UPDATE product_items 
SET condition = 'good' 
WHERE condition = 'excellent';

-- Step 2: Update existing 'excellent' values to 'good' in item_histories  
UPDATE item_histories 
SET condition = 'good' 
WHERE condition = 'excellent';

-- Step 3: Handle any other invalid condition values
-- Update any NULL or invalid values to 'unknown'
UPDATE product_items 
SET condition = 'unknown' 
WHERE condition IS NULL 
   OR condition NOT IN ('good', 'fair', 'caution', 'needs_repair', 'unknown');

UPDATE item_histories 
SET condition = 'unknown' 
WHERE condition IS NOT NULL 
   AND condition NOT IN ('good', 'fair', 'caution', 'needs_repair', 'unknown');

-- Step 4: Now drop the existing constraint
ALTER TABLE product_items 
DROP CONSTRAINT IF EXISTS product_items_condition_check;

-- Step 5: Add the new constraint with updated condition values
ALTER TABLE product_items 
ADD CONSTRAINT product_items_condition_check 
CHECK (condition IN ('good', 'fair', 'caution', 'needs_repair', 'unknown'));

-- Step 6: Update the item_histories table constraint as well (if it exists)
ALTER TABLE item_histories 
DROP CONSTRAINT IF EXISTS item_histories_condition_check;

ALTER TABLE item_histories 
ADD CONSTRAINT item_histories_condition_check 
CHECK (condition IN ('good', 'fair', 'caution', 'needs_repair', 'unknown') OR condition IS NULL);

-- Step 7: Add comments
COMMENT ON CONSTRAINT product_items_condition_check ON product_items IS 'Product condition: good (良好), fair (普通), caution (注意), needs_repair (要修理), unknown (不明)';

-- Verify the changes
-- SELECT DISTINCT condition FROM product_items;
-- SELECT DISTINCT condition FROM item_histories WHERE condition IS NOT NULL;