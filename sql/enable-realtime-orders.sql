-- =============================================================================
-- Realtime の配信対象に orders / order_items を追加する
--
-- 2026-09-08 田口さんの確認結果:
--   配信リストに入っていたのは product_items と label_print_queue の2つだけ。
--   orders / order_items が入っていないため、購読は SUBSCRIBED になるのに
--   イベントが1件も来ず、発注・承認・準備・配送が他の端末に反映されなかった。
--   「もともとリアルタイム同期にしてたけどうまくいかなかった」の正体はこれ。
--
-- ⚠️ Claude は本番DBに対してSQLを実行しません。
--    Supabase ダッシュボードの SQL Editor で田口さんが実行してください。
--
-- 影響: 配信対象が増えるだけ。既存のデータ・スキーマは変わりません。
--       DELETE も DROP も TRUNCATE も含みません。
-- =============================================================================

-- 1) いま何が配信対象か（実行前の記録用）
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 2) 追加する
--    すでに入っている場合は "already member of publication" というエラーになります。
--    その場合はそのテーブルだけ飛ばして構いません（害はありません）。
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- 3) 追加されたか確認（orders / order_items / product_items / label_print_queue の
--    4つが並べば完了）
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- =============================================================================
-- 補足: 削除された行の通知について
--
-- 既定では DELETE の通知に主キーしか乗りません。アプリ側はそれで動くように
-- してありますが、削除された行の中身まで見たい場合は下を実行します。
-- 書き込み負荷が上がるので、必要になるまでは実行しないでください。
--
--   ALTER TABLE public.orders REPLICA IDENTITY FULL;
--   ALTER TABLE public.order_items REPLICA IDENTITY FULL;
--
-- 元に戻すとき:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.order_items;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
-- =============================================================================
