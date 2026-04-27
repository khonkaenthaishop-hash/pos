-- =====================================================
-- Migration: inventory_movements table
-- Dedicated movement log for receive / adjust / discard
-- Separate from stock_transactions (sale deductions)
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What moved
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type    VARCHAR(20) NOT NULL
                     CHECK (movement_type IN ('IN', 'OUT', 'ADJUST')),
  reason_code      VARCHAR(50) NOT NULL,

  -- Quantities stored in BASE UNITS always
  quantity_input   DECIMAL(12,2) NOT NULL,   -- as entered by user (may be in wholesale unit)
  quantity_base    DECIMAL(12,2) NOT NULL,   -- converted to base unit
  unit_input       VARCHAR(50),              -- unit the user entered
  unit_base        VARCHAR(50),              -- product base unit

  -- Financials
  cost_price       DECIMAL(10,2),            -- unit cost at time of receipt

  -- Reference
  reference_no     VARCHAR(100),
  notes            TEXT,

  -- Stock snapshot
  balance_before   DECIMAL(12,2) NOT NULL,
  balance_after    DECIMAL(12,2) NOT NULL,

  -- Who / when
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  supplier_id      UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_product_id    ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type          ON inventory_movements (movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created_at    ON inventory_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_reason_code   ON inventory_movements (reason_code);
CREATE INDEX IF NOT EXISTS idx_inv_mov_reference_no  ON inventory_movements (reference_no);
