-- Add missing fields to orders table
-- This fixes the issue where order_date and required_date are not displayed in the preparation screen

-- Add order_date column (発注日)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;

-- Add required_date column (希望納期日)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS required_date DATE;

-- Add notes column (備考)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add created_by column (作成者)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Add approval related columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT FALSE;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS approved_by TEXT;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS approved_date DATE;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Update existing records to have order_date same as created_at
UPDATE orders 
SET order_date = created_at::date 
WHERE order_date IS NULL;

-- Set a default required_date for existing records (7 days from order_date)
UPDATE orders 
SET required_date = (created_at::date + INTERVAL '7 days')::date 
WHERE required_date IS NULL;

-- Set a default created_by for existing records
UPDATE orders 
SET created_by = 'システム管理者' 
WHERE created_by IS NULL;