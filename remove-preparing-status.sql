-- Remove 'preparing' status from database constraints

-- Update product_items status constraint
ALTER TABLE product_items DROP CONSTRAINT IF EXISTS product_items_status_check;
ALTER TABLE product_items ADD CONSTRAINT product_items_status_check 
    CHECK (status IN ('available', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown'));

-- Update orders status constraint  
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'partial_approved', 'approved', 'ready', 'delivered', 'cancelled'));

-- Update order_items item_processing_status constraint
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_item_processing_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_item_processing_status_check 
    CHECK (item_processing_status IN ('waiting', 'ready', 'delivered', 'cancelled'));

-- Update any existing 'preparing' statuses to appropriate values
-- For product_items: change 'preparing' to 'available'
UPDATE product_items SET status = 'available' WHERE status = 'preparing';

-- For orders: change 'preparing' to 'approved' 
UPDATE orders SET status = 'approved' WHERE status = 'preparing';

-- For order_items: change 'preparing' to 'waiting'
UPDATE order_items SET item_processing_status = 'waiting' WHERE item_processing_status = 'preparing';