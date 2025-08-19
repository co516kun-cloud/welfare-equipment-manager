-- item_histories テーブルを作成
-- 福祉用具の状態変更履歴を記録するテーブル

CREATE TABLE public.item_histories (
    id TEXT PRIMARY KEY DEFAULT ('HIST-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || FLOOR(RANDOM() * 10000)::TEXT),
    item_id TEXT NOT NULL REFERENCES public.product_items(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'status_change', 'location_change', 'condition_change', 'customer_assign', etc.
    from_status TEXT,
    to_status TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    performed_by TEXT NOT NULL,
    location TEXT,
    condition TEXT,
    customer_name TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX idx_item_histories_item_id ON public.item_histories(item_id);
CREATE INDEX idx_item_histories_timestamp ON public.item_histories(timestamp DESC);
CREATE INDEX idx_item_histories_action ON public.item_histories(action);

-- RLSを有効化
ALTER TABLE public.item_histories ENABLE ROW LEVEL SECURITY;

-- 認証ユーザーのみアクセス可能なポリシーを作成
CREATE POLICY "authenticated_access_item_histories" ON public.item_histories
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_item_histories_updated_at
    BEFORE UPDATE ON public.item_histories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();