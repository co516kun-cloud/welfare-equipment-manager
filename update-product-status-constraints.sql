-- Update product_items table constraints to include 'ready_for_delivery' status
-- This script adds the new status to the existing status constraint

-- First, let's check the current constraint
-- You can run this to see the existing constraint:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%status%' AND conrelid = (SELECT oid FROM pg_class WHERE relname = 'product_items');

-- Drop the existing status constraint (if it exists)
ALTER TABLE product_items DROP CONSTRAINT IF EXISTS product_items_status_check;

-- Add the updated constraint with the new 'ready_for_delivery' status
ALTER TABLE product_items 
ADD CONSTRAINT product_items_status_check 
CHECK (status IN ('available', 'ready_for_delivery', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'product_items_status_check' 
AND conrelid = (SELECT oid FROM pg_class WHERE relname = 'product_items');