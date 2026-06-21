-- Migration: 009_add_system_user
-- Feature: Gmail Shipping Tracker — System User for audit logs
-- Date: 2026-06-21
-- Description: Inserts a "system" service-account user that the Gmail Shipping Tracker
--              uses when writing audit_logs for automated (non-human) actions.
--              The user is inactive and cannot log in.

BEGIN;

INSERT INTO users (
  id,
  username,
  password_hash,
  role,
  name_th,
  name_zh,
  name_en,
  is_active,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'system',
  -- Bcrypt of a random string — this account cannot be used to log in (is_active=false)
  '$2b$10$YK3ztCzZ4y5MzDQlN6iHDek/E8H1V9RhPNFrSSqWHlRg2t3E4QOSC',
  'admin',
  'ระบบอัตโนมัติ',
  '自動系統',
  'System',
  FALSE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000001'
     OR username = 'system'
);

COMMIT;
