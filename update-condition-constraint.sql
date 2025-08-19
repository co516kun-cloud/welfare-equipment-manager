-- Update product_items condition constraint to include 'caution'
-- Remove 'excellent' and add 'caution' to the condition options

-- Drop the existing constraint
ALTER TABLE product_items 
DROP CONSTRAINT IF EXISTS product_items_condition_check;

-- Add the new constraint with updated condition values
ALTER TABLE product_items 
ADD CONSTRAINT product_items_condition_check 
CHECK (condition IN ('good', 'fair', 'caution', 'needs_repair', 'unknown'));

-- Update the item_histories table constraint as well (if it exists)
ALTER TABLE item_histories 
DROP CONSTRAINT IF EXISTS item_histories_condition_check;

ALTER TABLE item_histories 
ADD CONSTRAINT item_histories_condition_check 
CHECK (condition IN ('good', 'fair', 'caution', 'needs_repair', 'unknown') OR condition IS NULL);

-- Comment on the updated constraint
COMMENT ON CONSTRAINT product_items_condition_check ON product_items IS 'Product condition: good (良好), fair (普通), caution (注意), needs_repair (要修理), unknown (不明)';

-- Condition definitions:
-- good: 良好
-- fair: 普通  
-- caution: 注意 (new)
-- needs_repair: 要修理
-- unknown: 不明
-- Removed: excellent (優良)