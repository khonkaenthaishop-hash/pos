-- Migration 004: Multi-location stock support
-- Creates location and product_location tables, migrates existing data

-- 1. location table
CREATE TABLE IF NOT EXISTS location (
  id SERIAL PRIMARY KEY,
  full_code VARCHAR(50) UNIQUE NOT NULL,
  zone VARCHAR(10),
  aisle VARCHAR(10),
  shelf VARCHAR(10),
  bin VARCHAR(10),
  barcode VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- 2. product_location table
CREATE TABLE IF NOT EXISTS product_location (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id INT NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(product_id, location_id),
  CONSTRAINT product_location_quantity_non_negative CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_location_product_id ON product_location(product_id);
CREATE INDEX IF NOT EXISTS idx_product_location_location_id ON product_location(location_id);

-- 3. Migrate existing locationCode → location table
INSERT INTO location (full_code)
SELECT DISTINCT location_code
FROM products
WHERE location_code IS NOT NULL AND location_code <> ''
ON CONFLICT (full_code) DO NOTHING;

-- 4. Migrate product stock → product_location
INSERT INTO product_location (product_id, location_id, quantity, priority)
SELECT
  p.id,
  l.id,
  GREATEST(COALESCE(p.current_stock, 0), 0),
  COALESCE(p.pick_sequence, 1)
FROM products p
JOIN location l ON l.full_code = p.location_code
WHERE p.location_code IS NOT NULL AND p.location_code <> ''
ON CONFLICT (product_id, location_id) DO NOTHING;

-- 5. Add location_id to stock_transactions (nullable, backward compatible)
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS location_id INT REFERENCES location(id);

-- 6. Add supplier_id to stock_transactions (nullable, backward compatible)
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
