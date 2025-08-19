-- Update existing tables and create orders/order_items tables for the welfare equipment management system

-- First, let's update the product_items table to include the 'preparing' status
ALTER TABLE product_items DROP CONSTRAINT IF EXISTS product_items_status_check;
ALTER TABLE product_items ADD CONSTRAINT product_items_status_check 
    CHECK (status IN ('available', 'preparing', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown'));

-- Create or update orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  assigned_to TEXT,
  carried_by TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'partial_approved', 'approved', 'preparing', 'ready', 'delivered', 'cancelled')),
  order_date DATE NOT NULL,
  required_date DATE NOT NULL,
  notes TEXT,
  created_by TEXT,
  needs_approval BOOLEAN DEFAULT FALSE,
  approved_by TEXT,
  approved_date DATE,
  approval_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create or update order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  assigned_item_ids TEXT[], -- Array of assigned product item IDs
  notes TEXT,
  item_status TEXT CHECK (item_status IN ('available', 'preparing', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown')),
  needs_approval BOOLEAN DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_date DATE,
  approval_notes TEXT,
  item_processing_status TEXT NOT NULL DEFAULT 'waiting' CHECK (item_processing_status IN ('waiting', 'preparing', 'ready', 'delivered', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_approval_status ON order_items(approval_status);
CREATE INDEX IF NOT EXISTS idx_order_items_item_processing_status ON order_items(item_processing_status);

-- Add some additional users for testing
INSERT INTO users (id, name, email, role, department) VALUES 
('USER-4', '山田花子', 'yamada@example.com', 'staff', '営業部'),
('USER-5', '高橋次郎', 'takahashi@example.com', 'manager', '配送部')
ON CONFLICT (id) DO NOTHING;

-- Update existing users to ensure they have proper email addresses
UPDATE users SET email = name || '@example.com' WHERE email IS NULL OR email = '';

-- Ensure all products have proper relationships
UPDATE products SET category_id = 'CAT-1' WHERE category_id IS NULL AND name LIKE '%車椅子%';
UPDATE products SET category_id = 'CAT-2' WHERE category_id IS NULL AND name LIKE '%ベッド%';
UPDATE products SET category_id = 'CAT-3' WHERE category_id IS NULL AND name LIKE '%歩行%';

-- Add more sample product items for testing
INSERT INTO product_items (id, product_id, status, condition, location, qr_code) VALUES 
('WC-003', 'PRD-1', 'available', 'good', '倉庫A-3', 'WC-003'),
('WC-004', 'PRD-1', 'available', 'excellent', '倉庫A-4', 'WC-004'),
('BED-002', 'PRD-2', 'available', 'good', '倉庫B-2', 'BED-002'),
('WK-002', 'PRD-3', 'available', 'excellent', '倉庫C-2', 'WK-002')
ON CONFLICT (id) DO NOTHING;