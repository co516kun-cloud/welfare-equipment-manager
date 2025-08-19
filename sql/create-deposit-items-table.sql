-- Deposit Items テーブル作成
CREATE TABLE deposit_items (
    id VARCHAR PRIMARY KEY,
    date DATE NOT NULL,
    customer_name VARCHAR NOT NULL,
    item_name VARCHAR NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 更新日時の自動更新トリガー（既存の関数を使用）
CREATE TRIGGER update_deposit_items_updated_at 
    BEFORE UPDATE ON deposit_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス作成
CREATE INDEX idx_deposit_items_date ON deposit_items(date DESC);
CREATE INDEX idx_deposit_items_customer_name ON deposit_items(customer_name);

-- RLS設定
ALTER TABLE deposit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON deposit_items
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON deposit_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON deposit_items
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON deposit_items
    FOR DELETE USING (auth.role() = 'authenticated');