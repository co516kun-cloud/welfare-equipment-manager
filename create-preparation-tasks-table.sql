-- preparation_tasks テーブルを作成
-- 発注準備タスクを管理するテーブル

CREATE TABLE public.preparation_tasks (
    id TEXT PRIMARY KEY DEFAULT ('TASK-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || FLOOR(RANDOM() * 10000)::TEXT),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL, -- OrderItemのID
    assigned_to TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleaning', 'maintenance', 'inspection', 'completed')),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX idx_preparation_tasks_order_id ON public.preparation_tasks(order_id);
CREATE INDEX idx_preparation_tasks_assigned_to ON public.preparation_tasks(assigned_to);
CREATE INDEX idx_preparation_tasks_status ON public.preparation_tasks(status);

-- RLSを有効化
ALTER TABLE public.preparation_tasks ENABLE ROW LEVEL SECURITY;

-- 認証ユーザーのみアクセス可能なポリシーを作成
CREATE POLICY "authenticated_access_preparation_tasks" ON public.preparation_tasks
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at の自動更新トリガー
CREATE TRIGGER update_preparation_tasks_updated_at
    BEFORE UPDATE ON public.preparation_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();