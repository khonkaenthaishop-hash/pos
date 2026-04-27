-- Simple quantity-based promotion fields (bundle pricing)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS promo_qty INTEGER,
  ADD COLUMN IF NOT EXISTS promo_price DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_products_promo_qty ON products(promo_qty);
