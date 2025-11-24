-- デモ機器の顧客名「田中」問題を修正するSQL

-- デモ機器テーブルから不要な顧客名データを削除
UPDATE demo_equipment 
SET customer_name = NULL 
WHERE customer_name LIKE '%田中%';

-- 確認用のクエリ（実行前にチェック）
-- SELECT id, name, management_number, customer_name, status 
-- FROM demo_equipment 
-- WHERE customer_name IS NOT NULL;