-- Add is_archived flag to orders table for logical deletion
-- This prevents old completed orders from being loaded during initial data fetch

-- Add the is_archived column with default FALSE
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for performance on archived queries
CREATE INDEX IF NOT EXISTS idx_orders_is_archived ON orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_orders_status_archived ON orders(status, is_archived);

-- Update existing completed orders older than 30 days to archived
-- Only archive orders that are in final states (completed, cancelled, etc.)
UPDATE orders 
SET is_archived = TRUE 
WHERE is_archived = FALSE 
  AND status IN ('completed', 'cancelled', 'rejected')
  AND updated_at < NOW() - INTERVAL '30 days';

-- Show summary of changes
SELECT 
  status,
  is_archived,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM orders 
GROUP BY status, is_archived 
ORDER BY status, is_archived;

COMMENT ON COLUMN orders.is_archived IS 'Logical deletion flag. TRUE = archived (hidden from normal queries), FALSE = active';