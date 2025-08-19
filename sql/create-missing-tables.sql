-- 不足している可能性のあるテーブルを作成
-- まず check-all-tables.sql を実行して、どのテーブルが不足しているか確認してください

-- 更新日時の自動更新関数（存在しない場合のみ作成）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. preparation_tasks テーブル（不足しがちなテーブル）
CREATE TABLE IF NOT EXISTS preparation_tasks (
    id VARCHAR PRIMARY KEY,
    order_id VARCHAR NOT NULL,
    item_id VARCHAR NOT NULL,
    assigned_to VARCHAR NOT NULL,
    status VARCHAR CHECK (status IN ('pending', 'cleaning', 'maintenance', 'inspection', 'completed')) NOT NULL DEFAULT 'pending',
    start_date VARCHAR NOT NULL,
    completed_date VARCHAR,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- preparation_tasks の更新トリガー
DROP TRIGGER IF EXISTS update_preparation_tasks_updated_at ON preparation_tasks;
CREATE TRIGGER update_preparation_tasks_updated_at 
    BEFORE UPDATE ON preparation_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- preparation_tasks のインデックス
CREATE INDEX IF NOT EXISTS idx_preparation_tasks_order_id ON preparation_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_preparation_tasks_status ON preparation_tasks(status);

-- 2. item_histories テーブル（不足しがちなテーブル）
CREATE TABLE IF NOT EXISTS item_histories (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    from_status VARCHAR NOT NULL,
    to_status VARCHAR NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    performed_by VARCHAR NOT NULL,
    location VARCHAR,
    condition VARCHAR,
    customer_name VARCHAR,
    condition_notes TEXT,
    metadata JSONB,
    notes TEXT
);

-- item_histories のインデックス
CREATE INDEX IF NOT EXISTS idx_item_histories_item_id ON item_histories(item_id);
CREATE INDEX IF NOT EXISTS idx_item_histories_timestamp ON item_histories(timestamp DESC);

-- 3. demo_equipment テーブル
CREATE TABLE IF NOT EXISTS demo_equipment (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    management_number VARCHAR NOT NULL UNIQUE,
    status VARCHAR CHECK (status IN ('available', 'demo')) NOT NULL DEFAULT 'available',
    customer_name VARCHAR,
    loan_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- demo_equipment の更新トリガー
DROP TRIGGER IF EXISTS update_demo_equipment_updated_at ON demo_equipment;
CREATE TRIGGER update_demo_equipment_updated_at 
    BEFORE UPDATE ON demo_equipment 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- demo_equipment のインデックス
CREATE INDEX IF NOT EXISTS idx_demo_equipment_status ON demo_equipment(status);
CREATE INDEX IF NOT EXISTS idx_demo_equipment_management_number ON demo_equipment(management_number);

-- 4. deposit_items テーブル
CREATE TABLE IF NOT EXISTS deposit_items (
    id VARCHAR PRIMARY KEY,
    date DATE NOT NULL,
    customer_name VARCHAR NOT NULL,
    item_name VARCHAR NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- deposit_items の更新トリガー
DROP TRIGGER IF EXISTS update_deposit_items_updated_at ON deposit_items;
CREATE TRIGGER update_deposit_items_updated_at 
    BEFORE UPDATE ON deposit_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- deposit_items のインデックス
CREATE INDEX IF NOT EXISTS idx_deposit_items_date ON deposit_items(date DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_items_customer_name ON deposit_items(customer_name);

-- 5. 基本テーブルが不足している場合（稀ですが念のため）

-- categories テーブル
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    icon VARCHAR
);

-- products テーブル
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    category_id VARCHAR REFERENCES categories(id),
    description TEXT,
    manufacturer VARCHAR,
    model VARCHAR
);

-- users テーブル
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    role VARCHAR CHECK (role IN ('admin', 'staff', 'manager')) NOT NULL,
    department VARCHAR,
    territory VARCHAR
);

-- product_items テーブル
CREATE TABLE IF NOT EXISTS product_items (
    id VARCHAR PRIMARY KEY,
    product_id VARCHAR REFERENCES products(id),
    status VARCHAR CHECK (status IN ('available', 'ready_for_delivery', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown')) NOT NULL DEFAULT 'available',
    condition VARCHAR CHECK (condition IN ('good', 'fair', 'caution', 'needs_repair', 'unknown')) NOT NULL DEFAULT 'good',
    location VARCHAR,
    customer_name VARCHAR,
    loan_start_date DATE,
    qr_code VARCHAR UNIQUE NOT NULL,
    condition_notes TEXT
);

-- orders テーブル
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR PRIMARY KEY,
    customer_name VARCHAR NOT NULL,
    assigned_to VARCHAR NOT NULL,
    carried_by VARCHAR NOT NULL,
    status VARCHAR CHECK (status IN ('pending', 'partial_approved', 'approved', 'ready', 'delivered', 'cancelled')) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    order_date DATE NOT NULL,
    required_date DATE NOT NULL,
    notes TEXT,
    created_by VARCHAR NOT NULL,
    needs_approval BOOLEAN DEFAULT false,
    approved_by VARCHAR,
    approved_date DATE,
    approval_notes TEXT
);

-- order_items テーブル
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR PRIMARY KEY,
    order_id VARCHAR REFERENCES orders(id),
    product_id VARCHAR REFERENCES products(id),
    quantity INTEGER NOT NULL,
    assigned_item_ids TEXT[], -- PostgreSQL array type
    notes TEXT,
    item_status VARCHAR,
    needs_approval BOOLEAN DEFAULT false,
    approval_status VARCHAR CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected')) NOT NULL DEFAULT 'not_required',
    approved_by VARCHAR,
    approved_date DATE,
    approval_notes TEXT,
    item_processing_status VARCHAR CHECK (item_processing_status IN ('waiting', 'ready', 'delivered', 'cancelled')) NOT NULL DEFAULT 'waiting'
);

-- 完了メッセージ
SELECT '✅ 不足テーブルの作成が完了しました。再度 check-all-tables.sql を実行して確認してください。' as message;