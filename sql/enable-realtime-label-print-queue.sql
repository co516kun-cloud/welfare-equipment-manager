-- label_print_queue を Realtime の配信対象にする（2026-09-04）
--
-- 印刷エージェント（mcp-server/src/print-agent）は行の INSERT を Realtime で購読して即座に印刷する。
-- このSQLを流していなくても 15 秒ごとの polling で動くが、流すと「押して1〜3秒」になる。
--
-- Supabase ダッシュボード > SQL Editor で実行:
ALTER PUBLICATION supabase_realtime ADD TABLE public.label_print_queue;

-- 確認（label_print_queue が出ればOK）:
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
