-- 寄贈済み（donated）ステータスを追加する（2026-11-02）
--
-- 影響範囲: product_items の status チェック制約だけ。既存の行は変更しない。
-- 本番に当たっている現行の制約は、2026-08-20 に 'disposed' を足したもの（11種）。
-- このファイルはそれに 'donated' を足した 12種で作り直す。
--
-- ⚠️ アプリを本番に出す「前」に、Supabase ダッシュボードの SQL Editor で流すこと。
--    先にアプリが出ると、寄贈を押した瞬間に制約違反で保存に失敗する。

ALTER TABLE product_items
DROP CONSTRAINT IF EXISTS product_items_status_check;

ALTER TABLE product_items
ADD CONSTRAINT product_items_status_check
CHECK (status IN (
  'available',
  'reserved',
  'ready_for_delivery',
  'rented',
  'returned',
  'cleaning',
  'maintenance',
  'demo_cancelled',
  'out_of_order',
  'unknown',
  'disposed',
  'donated'
));

-- 確認: 制約の中身に 'donated' が入っていれば成功
SELECT pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'product_items_status_check';
