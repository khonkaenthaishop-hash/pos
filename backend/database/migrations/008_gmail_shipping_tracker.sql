-- Migration: 008_gmail_shipping_tracker
-- Feature: Gmail Shipping Tracker
-- Date: 2026-06-21
-- Description: Tables for Gmail OAuth2 credentials, parsed shipping emails,
--              and order-to-shipment tracking (auto-match via phone_last3 + amount + date)

-- ─── 1. Extend existing enums (must be outside transaction) ──────────────────
ALTER TYPE order_status      ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE audit_action      ADD VALUE IF NOT EXISTS 'SHIPPING_STATUS_UPDATE';
ALTER TYPE audit_action      ADD VALUE IF NOT EXISTS 'GMAIL_SYNC';

BEGIN;

-- ─── 2. gmail_credentials ─────────────────────────────────────────────────────
-- Stores OAuth2 tokens for the Gmail account that receives 7-11 shipping emails.
-- Tokens are stored AES-256-GCM encrypted. One record per store (single-tenant).

CREATE TABLE IF NOT EXISTS gmail_credentials (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        VARCHAR(50) NOT NULL DEFAULT 'default',
  email_address   VARCHAR(255) NOT NULL,
  access_token    TEXT        NOT NULL,   -- encrypted
  refresh_token   TEXT        NOT NULL,   -- encrypted
  token_expiry    TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active | expired | revoked
  last_sync_at    TIMESTAMPTZ,
  last_sync_count INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gmail_credentials_store_unique UNIQUE (store_id)
);

-- ─── 3. shipping_emails ───────────────────────────────────────────────────────
-- Stores every parsed email from no-reply@sp88.com (7-ELEVEN 賣貨便).
-- gmail_message_id is the idempotency key — re-syncing never creates duplicates.

CREATE TABLE IF NOT EXISTS shipping_emails (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id    VARCHAR(255) NOT NULL,
  email_type          VARCHAR(30)  NOT NULL,
  -- email_type values:
  --   created    = 訂單成立通知
  --   shipped    = 賣家完成寄貨訂單通知
  --   arrived    = 您的訂單已送達
  --   completed  = 賣家完成取貨訂單通知
  --   cancelled  = 買家訂單取消通知
  --   warning    = 賣家未於3天內取貨
  --   returned   = 商品未於期限內取貨
  subject             TEXT         NOT NULL,
  received_at         TIMESTAMPTZ  NOT NULL,

  -- Parsed fields from email body
  cm_order_number     VARCHAR(50),                   -- e.g. CM2606170063142
  c_number            VARCHAR(50),                   -- e.g. C72529686308 (交貨便服務代碼) — customer tracking code
  order_date          DATE,
  phone_last3         VARCHAR(3),                    -- last 3 digits of recipient phone (for matching)
  payment_method      VARCHAR(30),                   -- 取貨付款 | 信用卡 etc.
  delivery_method     VARCHAR(100),                  -- 店取：7-ELEVEN-冷凍 etc.
  subtotal            DECIMAL(10,2),
  shipping_fee        DECIMAL(10,2),
  total_amount        DECIMAL(10,2),

  -- Matching result (phone_last3 + total_amount + order_date)
  matched_order_id    UUID         REFERENCES orders(id) ON DELETE SET NULL,
  match_status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- match_status: pending | matched | unmatched | manual
  amount_mismatch     JSONB,
  -- e.g. {"email_total": 550, "pos_total": 500, "diff": 50}

  -- Admin confirmation
  admin_confirmed     BOOLEAN      NOT NULL DEFAULT FALSE,
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        UUID         REFERENCES users(id) ON DELETE SET NULL,

  -- Processing state
  process_status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- process_status: pending | processed | skipped | error
  process_error       TEXT,
  processed_at        TIMESTAMPTZ,

  -- Raw body for debugging / re-parsing
  raw_body            TEXT,

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT shipping_emails_gmail_id_unique UNIQUE (gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_shipping_emails_cm        ON shipping_emails(cm_order_number);
CREATE INDEX IF NOT EXISTS idx_shipping_emails_c_number  ON shipping_emails(c_number);
CREATE INDEX IF NOT EXISTS idx_shipping_emails_match     ON shipping_emails(match_status);
CREATE INDEX IF NOT EXISTS idx_shipping_emails_type      ON shipping_emails(email_type);
CREATE INDEX IF NOT EXISTS idx_shipping_emails_date      ON shipping_emails(order_date);
CREATE INDEX IF NOT EXISTS idx_shipping_emails_phone3    ON shipping_emails(phone_last3);
CREATE INDEX IF NOT EXISTS idx_shipping_emails_confirmed ON shipping_emails(admin_confirmed);

-- ─── 4. shipping_tracking ─────────────────────────────────────────────────────
-- Links a POS order to its 7-11 shipment (CM number + C number).
-- Populated automatically after auto-match succeeds.

CREATE TABLE IF NOT EXISTS shipping_tracking (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cm_order_number VARCHAR(50),                      -- CM2606170063142
  c_number        VARCHAR(50),                      -- C72529686308 (customer tracking code)
  carrier         VARCHAR(30) NOT NULL DEFAULT 'seven_eleven',
  current_status  VARCHAR(30) NOT NULL DEFAULT 'created',
  status_history  JSONB       NOT NULL DEFAULT '[]',
  -- e.g. [{"status": "arrived", "timestamp": "...", "email_id": "..."}]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT shipping_tracking_order_unique  UNIQUE (order_id),
  CONSTRAINT shipping_tracking_cm_unique     UNIQUE (cm_order_number)
);

CREATE INDEX IF NOT EXISTS idx_shipping_tracking_order    ON shipping_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_c_number ON shipping_tracking(c_number);
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_status   ON shipping_tracking(current_status);

COMMIT;
