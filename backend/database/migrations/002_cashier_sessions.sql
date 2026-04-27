-- =====================================================
-- Migration: cashier_sessions table
-- =====================================================

CREATE TABLE IF NOT EXISTS cashier_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE NOT NULL,
  cashier_id      UUID NOT NULL REFERENCES users(id),
  opening_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_amount  NUMERIC(12,2),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Only one open session per cashier per day
  CONSTRAINT uq_cashier_session_date UNIQUE (cashier_id, date)
);

CREATE INDEX IF NOT EXISTS idx_cashier_sessions_date       ON cashier_sessions (date);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_cashier_id ON cashier_sessions (cashier_id);
