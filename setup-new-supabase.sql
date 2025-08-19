-- 新しいSupabaseプロジェクト用テーブル作成SQL

-- 1. Categories テーブル
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Products テーブル
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  description TEXT,
  manufacturer TEXT,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Product Items テーブル
CREATE TABLE product_items (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  status TEXT NOT NULL DEFAULT 'available',
  condition TEXT NOT NULL DEFAULT 'good',
  location TEXT,
  qr_code TEXT,
  customer_name TEXT,
  loan_start_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Users テーブル
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff',
  department TEXT,
  territory TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Orders テーブル
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  assigned_to TEXT,
  carried_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  order_date DATE NOT NULL,
  required_date DATE NOT NULL,
  notes TEXT,
  created_by TEXT,
  needs_approval BOOLEAN DEFAULT FALSE,
  approved_by TEXT,
  approved_date DATE,
  approval_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Order Items テーブル
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  assigned_item_ids TEXT[],
  notes TEXT,
  item_status TEXT,
  needs_approval BOOLEAN DEFAULT FALSE,
  approval_status TEXT DEFAULT 'not_required',
  approved_by TEXT,
  approved_date DATE,
  approval_notes TEXT,
  item_processing_status TEXT DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Item Histories テーブル
CREATE TABLE item_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location TEXT,
  condition TEXT,
  customer_name TEXT,
  condition_notes TEXT,
  photos TEXT[],
  metadata JSONB
);

-- 8. Preparation Tasks テーブル
CREATE TABLE preparation_tasks (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  item_id TEXT REFERENCES product_items(id),
  assigned_to TEXT,
  status TEXT DEFAULT 'pending',
  start_date DATE,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Demo Equipment テーブル
CREATE TABLE demo_equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  management_number TEXT UNIQUE,
  status TEXT DEFAULT 'available',
  customer_name TEXT,
  loan_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Deposit Items テーブル
CREATE TABLE deposit_items (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS の有効化
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_items ENABLE ROW LEVEL SECURITY;

-- 基本的なアクセスポリシー
CREATE POLICY "allow_all_categories" ON categories FOR ALL USING (true);
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true);
CREATE POLICY "allow_all_product_items" ON product_items FOR ALL USING (true);
CREATE POLICY "allow_all_users" ON users FOR ALL USING (true);
CREATE POLICY "allow_all_orders" ON orders FOR ALL USING (true);
CREATE POLICY "allow_all_order_items" ON order_items FOR ALL USING (true);
CREATE POLICY "allow_all_item_histories" ON item_histories FOR ALL USING (true);
CREATE POLICY "allow_all_preparation_tasks" ON preparation_tasks FOR ALL USING (true);
CREATE POLICY "allow_all_demo_equipment" ON demo_equipment FOR ALL USING (true);
CREATE POLICY "allow_all_deposit_items" ON deposit_items FOR ALL USING (true);

-- サンプルデータの挿入
INSERT INTO categories (id, name, description, icon) VALUES
('cat_001', '車椅子', '車椅子各種', '♿'),
('cat_002', '特殊寝台', 'ベッド・マットレス', '🛏️'),
('cat_003', '歩行補助', '歩行器・杖', '🚶');

INSERT INTO products (id, name, category_id, description, manufacturer, model) VALUES
('prd_001', '電動車椅子A', 'cat_001', '軽量電動車椅子', 'メーカーA', 'WC-100'),
('prd_002', '手動車椅子B', 'cat_001', '折りたたみ式車椅子', 'メーカーB', 'WC-200'),
('prd_003', '特殊寝台C', 'cat_002', '電動リクライニングベッド', 'メーカーC', 'BD-300');

INSERT INTO product_items (id, product_id, status, condition, location) VALUES
('WC-001', 'prd_001', 'available', 'good', 'A-1'),
('WC-002', 'prd_001', 'rented', 'good', ''),
('WC-003', 'prd_002', 'available', 'good', 'A-2'),
('BD-001', 'prd_003', 'available', 'excellent', 'B-1');

INSERT INTO users (id, name, email, role, department) VALUES
('usr_001', '管理者', 'admin@example.com', 'admin', '管理部'),
('usr_002', '営業太郎', 'sales@example.com', 'staff', '営業部');