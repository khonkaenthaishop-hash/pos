-- Add pack barcode support for unit/pack scanning (single stock pool in base unit)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pack_barcode VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'uq_products_pack_barcode'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT uq_products_pack_barcode UNIQUE (pack_barcode);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_pack_barcode ON products(pack_barcode);
