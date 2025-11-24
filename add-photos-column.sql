-- 商品個体テーブルに写真フィールドを追加

-- product_itemsテーブルにphotosカラムを追加（JSON配列形式）
ALTER TABLE product_items 
ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;

-- カラムにコメントを追加
COMMENT ON COLUMN product_items.photos IS 'メンテナンス時の写真（Base64形式の配列）';

-- 確認用のクエリ
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'product_items' AND column_name = 'photos';