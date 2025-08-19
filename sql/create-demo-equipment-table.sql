-- Demo Equipment テーブル作成
CREATE TABLE demo_equipment (
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

-- 更新日時の自動更新トリガー（既存の関数を使用）
CREATE TRIGGER update_demo_equipment_updated_at 
    BEFORE UPDATE ON demo_equipment 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス作成
CREATE INDEX idx_demo_equipment_status ON demo_equipment(status);
CREATE INDEX idx_demo_equipment_management_number ON demo_equipment(management_number);

-- RLS設定
ALTER TABLE demo_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON demo_equipment
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON demo_equipment
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON demo_equipment
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON demo_equipment
    FOR DELETE USING (auth.role() = 'authenticated');