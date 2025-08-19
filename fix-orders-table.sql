-- Fix orders table to add missing columns and complete the schema
-- This script addresses the "column 'order_date' does not exist" error

-- Add missing columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS required_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_date DATE,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Update the status constraint to include all needed statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'partial_approved', 'approved', 'preparing', 'ready', 'delivered', 'cancelled'));

-- Ensure product_items table has the 'preparing' status
ALTER TABLE product_items DROP CONSTRAINT IF EXISTS product_items_status_check;
ALTER TABLE product_items ADD CONSTRAINT product_items_status_check 
    CHECK (status IN ('available', 'preparing', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown'));

-- Update order_items table structure
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS assigned_item_ids TEXT[],
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS item_status TEXT,
ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_date DATE,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS item_processing_status TEXT DEFAULT 'waiting';

-- Add constraints for order_items
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_item_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_item_status_check 
    CHECK (item_status IS NULL OR item_status IN ('available', 'preparing', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown'));

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_approval_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_approval_status_check 
    CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected'));

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_item_processing_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_item_processing_status_check 
    CHECK (item_processing_status IN ('waiting', 'preparing', 'ready', 'delivered', 'cancelled'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_approval_status ON order_items(approval_status);
CREATE INDEX IF NOT EXISTS idx_order_items_item_processing_status ON order_items(item_processing_status);

-- Add more sample product items for testing
INSERT INTO product_items (id, product_id, status, condition, location, qr_code) VALUES 
('WC-003', 'PRD-1', 'available', 'good', '倉庫A-3', 'WC-003'),
('WC-004', 'PRD-1', 'available', 'excellent', '倉庫A-4', 'WC-004'),
('BED-002', 'PRD-2', 'available', 'good', '倉庫B-2', 'BED-002'),
('WK-002', 'PRD-3', 'available', 'excellent', '倉庫C-2', 'WK-002')
ON CONFLICT (id) DO NOTHING;