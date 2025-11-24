-- ラベル印刷キューテーブルの作成
-- Brother QL-800 ラベルプリンター連携機能用

CREATE TABLE IF NOT EXISTS label_print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  management_id TEXT NOT NULL,
  condition_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printing', 'completed', 'failed')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  printed_at TIMESTAMP WITH TIME ZONE,
  printed_by TEXT,
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_label_print_queue_item_id ON label_print_queue(item_id);
CREATE INDEX IF NOT EXISTS idx_label_print_queue_status ON label_print_queue(status);
CREATE INDEX IF NOT EXISTS idx_label_print_queue_created_at ON label_print_queue(created_at DESC);

-- RLS (Row Level Security) の設定
ALTER TABLE label_print_queue ENABLE ROW LEVEL SECURITY;

-- ポリシーの作成（全ユーザーが読み書き可能）
CREATE POLICY "Enable read access for all users" ON label_print_queue
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON label_print_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON label_print_queue
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON label_print_queue
  FOR DELETE USING (true);

-- updated_at カラムの自動更新トリガー
CREATE OR REPLACE FUNCTION update_label_print_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_label_print_queue_updated_at
  BEFORE UPDATE ON label_print_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_label_print_queue_updated_at();

-- コメント追加
COMMENT ON TABLE label_print_queue IS 'ラベル印刷待ちキュー';
COMMENT ON COLUMN label_print_queue.item_id IS '商品アイテムID（product_items.id）';
COMMENT ON COLUMN label_print_queue.product_name IS '商品名（印刷時点での値）';
COMMENT ON COLUMN label_print_queue.management_id IS '管理番号';
COMMENT ON COLUMN label_print_queue.condition_notes IS '商品状態メモ';
COMMENT ON COLUMN label_print_queue.status IS '印刷ステータス: pending, printing, completed, failed';
COMMENT ON COLUMN label_print_queue.created_by IS '印刷キュー作成者';
COMMENT ON COLUMN label_print_queue.printed_by IS '印刷実行者';
