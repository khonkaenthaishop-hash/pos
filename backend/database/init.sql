-- ==========================================
-- ร้านขอนแก่น POS — Database Schema
-- ==========================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- ENUM TYPES
-- ==========================================

CREATE TYPE user_role AS ENUM (
  'owner',      -- เจ้าของร้าน
  'manager',    -- ผู้จัดการ
  'cashier',    -- แคชเชียร์
  'staff',      -- พนักงาน
  'admin',      -- แอดมินตอบแชท
  'readonly'    -- ดูอย่างเดียว
);

CREATE TYPE order_type AS ENUM ('pos', 'online');
CREATE TYPE order_status AS ENUM (
  'pending',    -- รอดำเนินการ
  'confirmed',  -- ยืนยันแล้ว
  'packing',    -- กำลังแพ็ค
  'shipped',    -- ส่งแล้ว
  'delivered',  -- ส่งถึงแล้ว
  'cancelled',  -- ยกเลิก
  'claimed'     -- ร้องเรียน
);

CREATE TYPE temperature_type AS ENUM ('normal', 'cold', 'frozen');
CREATE TYPE carrier_name AS ENUM (
  'seven_eleven', 'family_mart', 'ok_mart',
  'hilife', 'black_cat', 'post'
);
CREATE TYPE package_size AS ENUM ('small', 'medium', 'large');
CREATE TYPE payment_method AS ENUM ('transfer', 'cod', 'cash', 'qr', 'debt');
CREATE TYPE audit_action AS ENUM (
  'STOCK_ADJUST',
  'STOCK_RECEIVE',
  'PRICE_CHANGE',
  'ORDER_CANCEL',
  'ORDER_CREATE',
  'PRODUCT_APPROVE',
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'PRODUCT_DELETE',
  'BILL_VOID',
  'WRONG_ITEM_PACKED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_CREATE',
  'USER_DEACTIVATE',
  'USER_ACTIVATE',
  'ORDER_RETURN'
);
CREATE TYPE claim_type AS ENUM ('refund', 'resend', 'discount');
CREATE TYPE app_language AS ENUM ('th', 'zh_TW', 'en');

-- ==========================================
-- USERS
-- ==========================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'staff',
  name_th       VARCHAR(100),
  name_zh       VARCHAR(100),
  name_en       VARCHAR(100),
  phone         VARCHAR(20),
  preferred_lang app_language DEFAULT 'th',
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CATEGORIES
-- ==========================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_th     VARCHAR(100) NOT NULL,
  name_zh     VARCHAR(100),
  name_en     VARCHAR(100),
  type        VARCHAR(50),  -- grocery, mookata, takraw, frozen, beverage, etc.
  icon        VARCHAR(10),  -- emoji icon
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PRODUCTS
-- ==========================================

-- Suppliers (for inventory)
CREATE TABLE suppliers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  phone        VARCHAR(50),
  email        VARCHAR(255),
  address      TEXT,
  tax_id       VARCHAR(50),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode          VARCHAR(50) UNIQUE,
  pack_barcode     VARCHAR(50) UNIQUE,
  sku              VARCHAR(50) UNIQUE,
  name_th          VARCHAR(200) NOT NULL,
  name_zh          VARCHAR(200),
  name_en          VARCHAR(200),
  category_id      UUID REFERENCES categories(id),
  cost_price       DECIMAL(10,4) DEFAULT 0,      -- ราคาทุน (ต่อหน่วยเล็กสุด)
  retail_price     DECIMAL(10,2) NOT NULL,         -- ราคาปลีก
  wholesale_price  DECIMAL(10,2),                  -- ราคาส่ง
  vat_rate         DECIMAL(5,2) DEFAULT 7.00,
  min_wholesale_qty INTEGER DEFAULT 1,
  promo_qty        INTEGER,
  promo_price      DECIMAL(10,2),
  unit             VARCHAR(20) DEFAULT 'ชิ้น',
  unit_zh          VARCHAR(20),
  unit_en          VARCHAR(20),
  base_unit        VARCHAR(50),
  wholesale_unit   VARCHAR(50),
  conversion_factor DECIMAL(10,4) DEFAULT 1,
  temperature_type temperature_type DEFAULT 'normal',
  current_stock    INTEGER DEFAULT 0,
  min_stock        INTEGER DEFAULT 5,             -- แจ้งเตือนเมื่อต่ำกว่า
  reserved_stock   INTEGER DEFAULT 0,             -- จอง (Online orders)
  expiry_date      DATE,
  lot_number       VARCHAR(50),
  location_code    VARCHAR(20),
  pick_sequence    INTEGER DEFAULT 0,
  supplier_id      UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  image_url        VARCHAR(500),
  description_th   TEXT,
  is_active        BOOLEAN DEFAULT true,
  is_approved      BOOLEAN DEFAULT false,          -- รออนุมัติ
  created_by       UUID REFERENCES users(id),
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_pack_barcode ON products(pack_barcode);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('simple', name_th));

-- ==========================================
-- STOCK BATCHES (รับของเข้า)
-- ==========================================

CREATE TABLE stock_batches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id),
  quantity      INTEGER NOT NULL,
  cost_price    DECIMAL(10,2),
  expire_date   DATE,
  note          TEXT,
  received_by   UUID REFERENCES users(id),
  received_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- STOCK TRANSACTIONS (audit trail)
-- ==========================================

CREATE TABLE stock_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('IN','ADJUST','OUT')),
  reason_code      VARCHAR(50) NOT NULL,
  quantity         DECIMAL(12,2) NOT NULL,
  unit             VARCHAR(50),
  cost_price       DECIMAL(10,4),
  reference_no     VARCHAR(100),
  notes            TEXT,
  balance_after    DECIMAL(12,2),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  location_id      INTEGER,               -- filled in after location table is created
  supplier_id      UUID,                  -- filled in after suppliers table is created
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stx_product_id  ON stock_transactions(product_id);
CREATE INDEX idx_stx_type        ON stock_transactions(transaction_type);
CREATE INDEX idx_stx_created_at  ON stock_transactions(created_at DESC);
CREATE INDEX idx_stx_reason      ON stock_transactions(reason_code);

-- ==========================================
-- CUSTOMER TIERS
-- ==========================================

CREATE TABLE customer_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_th         VARCHAR(50) NOT NULL,  -- 'ลูกค้าทั่วไป', 'ขายส่ง'
  name_zh         VARCHAR(50),
  name_en         VARCHAR(50),
  price_type      VARCHAR(20) DEFAULT 'retail',  -- retail / wholesale
  discount_pct    DECIMAL(5,2) DEFAULT 0,
  min_order_qty   INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CUSTOMERS
-- ==========================================

CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100),
  nickname      VARCHAR(50),           -- ชื่อเล่น / Facebook name
  phone         VARCHAR(20),
  facebook_id   VARCHAR(100),
  line_id       VARCHAR(100),
  tier_id       UUID REFERENCES customer_tiers(id),
  total_orders  INTEGER DEFAULT 0,
  total_spent   DECIMAL(12,2) DEFAULT 0,
  note          TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SHIPPING ADDRESSES
-- ==========================================

CREATE TABLE shipping_addresses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID REFERENCES customers(id),
  carrier           carrier_name,
  label             VARCHAR(50),       -- 'บ้าน', 'FM ใกล้บ้าน'
  -- สำหรับ Convenience store
  store_code        VARCHAR(20),
  store_name        VARCHAR(100),
  store_name_zh     VARCHAR(100),
  -- สำหรับ ส่งถึงบ้าน
  recipient_name_th VARCHAR(100),
  recipient_name_en VARCHAR(100),
  phone             VARCHAR(20),
  address_full      TEXT,
  address_zh        TEXT,
  is_default        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CARRIER RATES
-- ==========================================

CREATE TABLE carrier_rates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier          carrier_name NOT NULL,
  temperature      temperature_type DEFAULT 'normal',
  size             package_size,
  base_price       DECIMAL(8,2) NOT NULL,
  price_max        DECIMAL(8,2),                  -- กรณีมี range
  cod_available    BOOLEAN DEFAULT false,
  cod_limit        DECIMAL(10,2) DEFAULT 0,        -- วงเงิน COD สูงสุด
  cod_extra_fee    DECIMAL(8,2) DEFAULT 0,
  delivery_days    VARCHAR(20),                    -- '3-5 วัน', '1 วัน'
  weight_limit_kg  DECIMAL(8,2),
  is_active        BOOLEAN DEFAULT true
);

-- ==========================================
-- ORDERS
-- ==========================================

CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no         VARCHAR(30) UNIQUE NOT NULL,   -- ORD-20260413-001
  type             order_type NOT NULL,
  status           order_status DEFAULT 'pending',
  -- ลูกค้า
  customer_id      UUID REFERENCES customers(id),
  customer_name    VARCHAR(100),                   -- สำหรับ walk-in
  order_nickname   VARCHAR(100),                   -- ชื่อเล่น/Facebook
  -- การเงิน
  subtotal         DECIMAL(10,2) DEFAULT 0,
  discount         DECIMAL(10,2) DEFAULT 0,
  shipping_fee     DECIMAL(10,2) DEFAULT 0,
  total_amount     DECIMAL(10,2) DEFAULT 0,
  payment_method   payment_method DEFAULT 'cash',
  is_paid          BOOLEAN DEFAULT false,
  paid_at          TIMESTAMPTZ,
  -- การส่ง
  carrier          carrier_name,
  temperature      temperature_type DEFAULT 'normal',
  package_size     package_size,
  shipping_address_id UUID REFERENCES shipping_addresses(id),
  -- Staff
  cashier_id       UUID REFERENCES users(id),
  packed_by        UUID REFERENCES users(id),
  -- Meta
  note             TEXT,
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(type);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ==========================================
-- ORDER ITEMS
-- ==========================================

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  -- Snapshot ราคา ณ เวลาสั่ง
  product_name_th VARCHAR(200) NOT NULL,
  product_name_zh VARCHAR(200),
  product_name_en VARCHAR(200),
  unit_price      DECIMAL(10,2) NOT NULL,
  cost_price      DECIMAL(10,4) DEFAULT 0,   -- ราคาทุน ณ เวลาขาย (ต่อหน่วยเล็กสุด)
  quantity        INTEGER NOT NULL DEFAULT 1,
  item_discount   DECIMAL(10,2) DEFAULT 0,   -- ส่วนลดต่อรายการ
  subtotal        DECIMAL(10,2) NOT NULL,
  is_quick_item   BOOLEAN DEFAULT false,   -- รายการเร่งด่วน
  is_checked      BOOLEAN DEFAULT false,   -- พนักงานเช็คแล้ว (แพ็คของ)
  note            TEXT
);

-- ==========================================
-- SHIPMENTS
-- ==========================================

CREATE TABLE shipments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  carrier         carrier_name NOT NULL,
  tracking_no     VARCHAR(50),
  tracking_url    TEXT,
  status          VARCHAR(30) DEFAULT 'pending',
  -- Photo proof
  photo_url       VARCHAR(500),
  -- Notification
  notified_at     TIMESTAMPTZ,                     -- เวลาแจ้งลูกค้า
  notify_text     TEXT,                            -- ข้อความที่ copy ส่งลูกค้า
  -- Timestamps
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CLAIMS (ร้องเรียน)
-- ==========================================

CREATE TABLE claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  claim_type      claim_type,
  description     TEXT,
  photo_urls      TEXT[],
  refund_amount   DECIMAL(10,2),
  bank_account    VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'open',
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- AUDIT LOGS (ป้องกันโกง)
-- ==========================================

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id),
  action        audit_action NOT NULL,
  target_table  VARCHAR(50),
  target_id     UUID,
  old_value     JSONB,
  new_value     JSONB,
  reason        TEXT,                   -- บังคับกรอกสำหรับ sensitive actions
  ip_address    VARCHAR(45),
  device_info   VARCHAR(200),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_target ON audit_logs(target_table, target_id);

-- ==========================================
-- WRONG ITEM PENALTIES (ของตกสลับ)
-- ==========================================

CREATE TABLE wrong_item_penalties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id),
  packed_by       UUID REFERENCES users(id),
  penalty_amount  DECIMAL(8,2) DEFAULT 250,
  temperature     temperature_type,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- LOCATION (คลัง / ตำแหน่งจัดเก็บ)
-- ==========================================

CREATE TABLE location (
  id        SERIAL PRIMARY KEY,
  full_code VARCHAR(50) UNIQUE NOT NULL,
  zone      VARCHAR(50),
  aisle     VARCHAR(50),
  shelf     VARCHAR(50),
  bin       VARCHAR(50),
  barcode   VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PRODUCT LOCATION (สต็อกสินค้าแต่ละคลัง)
-- ==========================================

CREATE TABLE product_location (
  id          SERIAL PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id INT  NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  quantity    INT  NOT NULL DEFAULT 0,
  priority    INT  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id),
  CONSTRAINT product_location_qty_non_negative CHECK (quantity >= 0)
);

CREATE INDEX idx_product_location_product_id  ON product_location(product_id);
CREATE INDEX idx_product_location_location_id ON product_location(location_id);

-- Add FK constraints to stock_transactions now that location/suppliers exist
ALTER TABLE stock_transactions
  ADD CONSTRAINT fk_stx_location  FOREIGN KEY (location_id) REFERENCES location(id),
  ADD CONSTRAINT fk_stx_supplier  FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

-- ==========================================
-- INVENTORY MOVEMENTS (รับ/ปรับ/ทิ้งสินค้า)
-- ==========================================

CREATE TABLE inventory_movements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type  VARCHAR(20) NOT NULL CHECK (movement_type IN ('IN','OUT','ADJUST')),
  reason_code    VARCHAR(50) NOT NULL,
  quantity_input DECIMAL(12,2) NOT NULL,
  quantity_base  DECIMAL(12,2) NOT NULL,
  unit_input     VARCHAR(50),
  unit_base      VARCHAR(50),
  cost_price     DECIMAL(10,4),
  reference_no   VARCHAR(100),
  notes          TEXT,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after  DECIMAL(12,2) NOT NULL,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  supplier_id    UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_mov_product_id   ON inventory_movements(product_id);
CREATE INDEX idx_inv_mov_type         ON inventory_movements(movement_type);
CREATE INDEX idx_inv_mov_created_at   ON inventory_movements(created_at DESC);
CREATE INDEX idx_inv_mov_reason_code  ON inventory_movements(reason_code);
CREATE INDEX idx_inv_mov_reference_no ON inventory_movements(reference_no);

-- ==========================================
-- CASHIER SESSIONS
-- ==========================================

CREATE TABLE cashier_sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date           DATE NOT NULL,
  cashier_id     UUID NOT NULL REFERENCES users(id),
  opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(12,2),
  status         VARCHAR(20) NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','closed')),
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cashier_session_date UNIQUE (cashier_id, date)
);

CREATE INDEX idx_cashier_sessions_date       ON cashier_sessions(date);
CREATE INDEX idx_cashier_sessions_cashier_id ON cashier_sessions(cashier_id);

-- ==========================================
-- HELD ORDERS (บิลพัก)
-- ==========================================

CREATE TABLE held_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label         VARCHAR(100),
  cashier_id    UUID REFERENCES users(id),
  customer_id   UUID REFERENCES customers(id),
  customer_name VARCHAR(200),
  cart          JSONB NOT NULL DEFAULT '[]',
  discount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_held_orders_cashier_id ON held_orders(cashier_id);
CREATE INDEX idx_held_orders_created_at ON held_orders(created_at DESC);

-- ==========================================
-- SEED DATA
-- ==========================================

-- Default admin user (password: admin1234)
INSERT INTO users (username, password_hash, role, name_th, name_zh, name_en) VALUES
('owner',   '$2b$10$VrZ/WS0nplw09ItgpcFi6erqthsfg2j6W1oOwbAdWiUZaZ9Uk13sS', 'owner',   'เจ้าของร้าน', '店主',   'Owner'),
('manager', '$2b$10$VrZ/WS0nplw09ItgpcFi6erqthsfg2j6W1oOwbAdWiUZaZ9Uk13sS', 'manager', 'ผู้จัดการ',   '經理',   'Manager'),
('cashier', '$2b$10$VrZ/WS0nplw09ItgpcFi6erqthsfg2j6W1oOwbAdWiUZaZ9Uk13sS', 'cashier', 'แคชเชียร์',  '收銀員', 'Cashier'),
('staff',   '$2b$10$VrZ/WS0nplw09ItgpcFi6erqthsfg2j6W1oOwbAdWiUZaZ9Uk13sS', 'staff',   'พนักงาน',    '員工',   'Staff'),
('admin',   '$2b$10$VrZ/WS0nplw09ItgpcFi6erqthsfg2j6W1oOwbAdWiUZaZ9Uk13sS', 'admin',   'แอดมิน',     '管理員', 'Admin');

-- Customer Tiers
INSERT INTO customer_tiers (name_th, name_zh, name_en, price_type) VALUES
('ลูกค้าทั่วไป', '一般客戶', 'Regular Customer', 'retail'),
('ลูกค้าขายส่ง', '批發客戶', 'Wholesale Customer', 'wholesale');

-- Categories
INSERT INTO categories (name_th, name_zh, name_en, type, icon) VALUES
('เครื่องปรุง',      '調味料',   'Seasoning',      'seasoning',  '🌶️'),
('ของใช้',           '日用品',   'Household',      'household',  '🧴'),
('อาหารแช่แข็ง',    '冷凍食品', 'Frozen Food',    'frozen',     '❄️'),
('ผัก/ผลไม้',       '蔬菜水果', 'Vegetables',     'vegetable',  '🥬'),
('เครื่องดื่ม',     '飲料',     'Beverage',       'beverage',   '🥤'),
('ของตามกระแส',     '流行商品', 'Trending',       'trending',   '🔥'),
('ขนมหวาน',         '甜點',     'Dessert',        'dessert',    '🍬'),
('ยำ/ส้มตำ',        '涼拌菜',   'Thai Salad',     'salad',      '🥗'),
('กับแกล้ม',         '小菜',     'Side Dish',      'side',       '🍖'),
('หมูกะทะ',         '烤肉',     'Mookata',        'mookata',    '🍖'),
('ลานตะกร้อ',       '藤球場',   'Takraw Court',   'takraw',     '⚽');

-- Default Locations (คลัง)
INSERT INTO location (full_code, zone) VALUES
  ('FRONT', 'หน้าร้าน'),
  ('BACK',  'หลังร้าน');

-- Carrier Rates
INSERT INTO carrier_rates (carrier, temperature, size, base_price, price_max, cod_available, cod_limit, delivery_days, weight_limit_kg) VALUES
-- 7-Eleven
('seven_eleven', 'normal', NULL, 70,  NULL, true,  20000, '3-5 วัน', 5),
('seven_eleven', 'cold',   NULL, 150, NULL, true,  20000, '3-5 วัน', 10),
-- Family Mart
('family_mart',  'normal', NULL, 80,  NULL, true,  5000,  '3-5 วัน', 5),
('family_mart',  'cold',   NULL, 150, NULL, true,  5000,  '3-5 วัน', 10),
-- OK Mart
('ok_mart',      'normal', NULL, 70,  NULL, true,  5000,  '3-5 วัน', NULL),
('ok_mart',      'cold',   NULL, 150, NULL, true,  5000,  '3-5 วัน', NULL),
-- Hi-Life
('hilife',       'normal', NULL, 70,  NULL, false, 0,     NULL,      NULL),
-- แมวดำ ธรรมดา
('black_cat',    'normal', 'small',  130, NULL, true, 0, '1 วัน', 1),
('black_cat',    'normal', 'medium', 170, NULL, true, 0, '1 วัน', 20),
('black_cat',    'normal', 'large',  210, 250,  true, 0, '1 วัน', 20),
-- แมวดำ เย็น
('black_cat',    'cold',   'small',  160, NULL, true, 0, '1 วัน', 1),
('black_cat',    'cold',   'medium', 225, NULL, true, 0, '1 วัน', 20),
('black_cat',    'cold',   'large',  290, 350,  true, 0, '1 วัน', 20),
-- ไปรษณีย์
('post',         'normal', 'small',  100, NULL, true, 0, NULL, NULL),
('post',         'normal', 'medium', 150, NULL, true, 0, NULL, NULL),
('post',         'normal', 'large',  200, NULL, true, 0, NULL, NULL);

-- Update COD extra fee for post
UPDATE carrier_rates SET cod_extra_fee = 30 WHERE carrier = 'post';

-- ==========================================
-- SETTINGS
-- ==========================================

CREATE TABLE store_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      VARCHAR(64) NOT NULL UNIQUE DEFAULT 'default',
  general       JSONB,
  receipt       JSONB,
  printer       JSONB,
  roles_perms   JSONB,
  inventory     JSONB,
  pricing       JSONB,
  shipping      JSONB,
  notifications JSONB,
  ai            JSONB,
  security      JSONB,
  analytics     JSONB,
  system_cfg    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings (store_id) VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TABLE warehouses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   VARCHAR(64) NOT NULL DEFAULT 'default',
  name       VARCHAR(120) NOT NULL,
  zone       VARCHAR(80),
  address    TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
