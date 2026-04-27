-- ============================================================
-- Migration 001: Inventory Enhancement
-- Run this on existing databases to apply new fields/tables
-- ============================================================

-- Extensions (for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Suppliers table (must be before products FK)
CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  phone       VARCHAR(50),
  email       VARCHAR(255),
  address     TEXT,
  tax_id      VARCHAR(50),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. New product fields
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS location_code      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pick_sequence      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate           DECIMAL(5,2) DEFAULT 7.00,
  ADD COLUMN IF NOT EXISTS min_wholesale_qty  INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_unit          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wholesale_unit     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS conversion_factor  DECIMAL(10,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expiry_date        DATE,
  ADD COLUMN IF NOT EXISTS lot_number         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- 3. Stock transactions table
CREATE TABLE IF NOT EXISTS stock_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('IN','ADJUST','OUT')),
  reason_code      VARCHAR(50) NOT NULL,
  quantity         DECIMAL(12,2) NOT NULL,
  unit             VARCHAR(50),
  cost_price       DECIMAL(10,2),
  reference_no     VARCHAR(100),
  notes            TEXT,
  balance_after    DECIMAL(12,2),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stx_product_id  ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stx_type        ON stock_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_stx_created_at  ON stock_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stx_reason      ON stock_transactions(reason_code);
