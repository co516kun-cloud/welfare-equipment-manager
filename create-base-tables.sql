-- Base tables for welfare equipment management system

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  description TEXT,
  manufacturer TEXT,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product items table
CREATE TABLE IF NOT EXISTS product_items (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  status TEXT NOT NULL CHECK (status IN ('available', 'preparing', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown')),
  condition TEXT NOT NULL CHECK (condition IN ('excellent', 'good', 'fair', 'needs_repair', 'unknown')),
  location TEXT,
  qr_code TEXT UNIQUE,
  customer_name TEXT,
  loan_start_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'manager')),
  department TEXT,
  territory TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
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

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  assigned_item_ids TEXT[], -- Array of assigned product item IDs
  notes TEXT,
  item_status TEXT CHECK (item_status IN ('available', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown')),
  needs_approval BOOLEAN DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_date DATE,
  approval_notes TEXT,
  item_processing_status TEXT NOT NULL DEFAULT 'waiting' CHECK (item_processing_status IN ('waiting', 'preparing', 'ready', 'delivered', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Item histories table
CREATE TABLE IF NOT EXISTS item_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL REFERENCES product_items(id),
  action TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  location TEXT,
  condition TEXT,
  customer_name TEXT,
  notes TEXT,
  metadata JSONB
);

-- Preparation tasks table
CREATE TABLE IF NOT EXISTS preparation_tasks (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  item_id TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cleaning', 'maintenance', 'inspection', 'completed')),
  start_date DATE NOT NULL,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_items_product_id ON product_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_items_status ON product_items(status);
CREATE INDEX IF NOT EXISTS idx_product_items_qr_code ON product_items(qr_code);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_item_histories_item_id ON item_histories(item_id);
CREATE INDEX IF NOT EXISTS idx_preparation_tasks_order_id ON preparation_tasks(order_id);

-- Insert sample data for testing
INSERT INTO categories (id, name, description, icon) VALUES 
('CAT-1', '車椅子', '手動・電動車椅子各種', '♿'),
('CAT-2', 'ベッド', '介護用ベッド・マットレス', '🛏️'),
('CAT-3', '歩行器', '歩行補助具', '🚶')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, category_id, description, manufacturer, model) VALUES 
('PRD-1', '標準車椅子', 'CAT-1', '軽量アルミフレーム車椅子', 'メーカーA', 'Model-X1'),
('PRD-2', '電動ベッド', 'CAT-2', '3モーター電動ベッド', 'メーカーB', 'Model-Y2'),
('PRD-3', '四輪歩行器', 'CAT-3', 'ブレーキ付き四輪歩行器', 'メーカーC', 'Model-Z3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_items (id, product_id, status, condition, location, qr_code) VALUES 
('WC-001', 'PRD-1', 'available', 'excellent', '倉庫A-1', 'WC-001'),
('WC-002', 'PRD-1', 'available', 'good', '倉庫A-2', 'WC-002'),
('BED-001', 'PRD-2', 'available', 'excellent', '倉庫B-1', 'BED-001'),
('WK-001', 'PRD-3', 'available', 'good', '倉庫C-1', 'WK-001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, role, department) VALUES 
('USER-1', '田中太郎', 'tanaka@example.com', 'staff', '営業部'),
('USER-2', '佐藤花子', 'sato@example.com', 'manager', '管理部'),
('USER-3', '鈴木次郎', 'suzuki@example.com', 'staff', '配送部')
ON CONFLICT (id) DO NOTHING;