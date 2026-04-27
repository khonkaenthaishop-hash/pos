-- =====================================================
-- Migration: held_orders table
-- Replaces the in-memory Map in OrdersService
-- =====================================================

CREATE TABLE IF NOT EXISTS held_orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label        VARCHAR(100),
  cashier_id   UUID REFERENCES users(id),
  customer_id  UUID REFERENCES customers(id),
  customer_name VARCHAR(200),
  cart         JSONB NOT NULL DEFAULT '[]',
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_held_orders_cashier_id ON held_orders (cashier_id);
CREATE INDEX IF NOT EXISTS idx_held_orders_created_at ON held_orders (created_at DESC);
