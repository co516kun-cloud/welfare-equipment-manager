-- Add cancellation tracking columns to order_items table

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Add index for cancelled_at for better performance on queries
CREATE INDEX IF NOT EXISTS idx_order_items_cancelled_at ON order_items(cancelled_at);