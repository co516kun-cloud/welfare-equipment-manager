-- Simple update to add 'ready_for_delivery' status to product_items table

-- Drop existing constraint if it exists
ALTER TABLE product_items DROP CONSTRAINT IF EXISTS product_items_status_check;

-- Add new constraint with 'ready_for_delivery' status
ALTER TABLE product_items 
ADD CONSTRAINT product_items_status_check 
CHECK (status IN (
  'available', 
  'ready_for_delivery', 
  'rented', 
  'returned', 
  'cleaning', 
  'maintenance', 
  'demo_cancelled', 
  'out_of_order', 
  'unknown'
));

-- Show confirmation
SELECT 'Constraint updated successfully' as message;