# Gmail Shipping Tracker - Feature Spec

**Status:** Confirmed
**Date:** 2026-06-21
**Author:** System Analyst
**Last Updated:** 2026-06-21 (decisions finalized from user)

---

## 1. Goal & Scope

### Problem
ร้านขอนแก่นใช้ 7-ELEVEN 賣貨便 (sp88.com) สำหรับขนส่งสินค้าในไต้หวัน

**Root Cause หลัก:** พนักงานที่ร้าน (ไต้หวัน) กรอกยอดเรียกเก็บปลายทาง (COD) ผิดในระบบ 7-11 ทั้งยอดเกิน ยอดขาด หรือลืมเก็บปลายทาง เมื่อของถึงลูกค้าแล้วแก้ไขไม่ทัน ส่งผลให้เกิดการเคลมสินค้าเกือบ **20% ต่อเดือน**

**Workflow จริง:**
1. Admin (ไทย) รับ order จาก Facebook → ส่งรายละเอียดเข้าแชทร้าน (ชื่อ, เบอร์, รหัส 7-11, รายการ, ยอด)
2. พนักงาน (ไต้หวัน) กรอกข้อมูลใน myship2.7-11.com.tw ด้วยมือ → ได้ label พร้อม CM number + C number
3. แพ็คของ → ส่ง 7-11 → ถ่ายรูปกล่องส่งให้ admin
4. ระบบขนส่งส่ง email แจ้งทุก lifecycle ไปยัง Gmail ของร้าน
5. **ปัญหา:** ไม่มีการ verify ว่ายอดที่พนักงานกรอกใน 7-11 ตรงกับยอดที่ admin สั่งหรือไม่

### Solution
สร้าง **Shipping Dashboard** ให้ admin เช็คและ confirm ทุกวัน:
1. ดึง email จาก Gmail (cron ทุก 15 นาที) → parse → auto-match กับ POS order
2. **Auto-match logic:** เบอร์โทร 3 ตัวท้าย + ยอดรวม + วันที่ (ไม่ต้องใช้ store หรือ CM number)
3. Dashboard แสดง: สถานะ, ยอด verify, C number (交貨便服務代碼) สำหรับ copy ส่งลูกค้า
4. Admin confirm รายวัน + copy C number ส่งลูกค้าได้เลย (ลูกค้าใช้ track ที่ eservice.7-11.com.tw)

**สองค่าหลักจาก email:**
- **CM number** (寄貨訂單編號): เช่น CM2606170063142 — ID order ใน 7-11
- **C number** (交貨便服務代碼): เช่น C72529686308 — ลูกค้าใช้ track พัสดุ ← **admin copy ส่งลูกค้า**

### Who it's for
- **Owner / Manager** — ดู shipping dashboard, ตรวจสอบ reconciliation
- **Staff** — ดู shipping status ของ orders ที่ตัวเองจัดส่ง
- **System** — cron job ที่ poll Gmail ทุกวัน

### In Scope
- Gmail API OAuth2 setup & token management
- Email polling (cron-based, ทุก N นาที)
- Email parsing สำหรับ sp88.com subject patterns ทั้ง 7 types
- Matching email กับ existing orders ผ่าน order number (CM...)
- Auto-update order status ตาม shipping lifecycle
- Amount reconciliation (email total vs POS total)
- Shipping tracking dashboard (frontend)
- Audit logging ของทุก status change ที่เกิดจาก email sync

### Out of Scope
- Push notifications / realtime updates (อนาคต)
- รองรับ carrier อื่นนอกจาก 7-ELEVEN 賣貨便
- ส่ง email ตอบกลับอัตโนมัติ
- Gmail webhook (Pub/Sub) — ใช้ polling ก่อนเพราะง่ายกว่า

---

## 2. Current-State Analysis

### 2.1 Orders Module
- **Entity:** `backend/src/modules/orders/order.entity.ts:60-153`
- Order มี field `orderNo` (format: `POS-YYYYMMDD-XXXXXXX` หรือ `ONL-YYYYMMDD-XXXXXXX`) — **ไม่ตรง** กับ CM... number จาก email
- **OrderStatus enum** (`order.entity.ts:20-28`): `pending | confirmed | packing | shipped | delivered | cancelled | claimed`
  - มี `delivered` (ถึง 7-11 แล้ว) และ `claimed` (ลูกค้ารับแล้ว) ซึ่ง map ได้กับ shipping lifecycle
  - **ไม่มี** status สำหรับ `returned` (คืนสินค้า) หรือ `warning` — ต้องพิจารณาเพิ่ม
- Financial fields: `subtotal`, `discount`, `shippingFee`, `totalAmount` (`order.entity.ts:89-99`)
- Carrier field: `carrier` enum (`order.entity.ts:111`) — มี `seven_eleven`
- มี `paymentMethod` enum ที่รวม `COD` (`order.entity.ts:101`)

### 2.2 Shipments Module
- **Entity:** `backend/src/modules/shipments/shipment.entity.ts:13-41`
- มี `orderNumber` (join กับ `orders.order_no`), `trackingNumber`, `carrier`, `status` (default "SHIPPED"), `notes`
- **ไม่มี field สำหรับ CM... tracking number จาก 7-11** — `trackingNumber` อาจใช้ได้ แต่ต้อง clarify ว่า CM number = tracking number หรือเป็น separate identifier
- Service (`shipment.service.ts:32-128`) — มี `create()` ที่ใช้ transaction + update order status เป็น SHIPPED

### 2.3 Matching Strategy (Confirmed)
**ไม่ใช้ CM number เป็น key หลัก** เพราะ CM number เกิดในระบบ 7-11 แยกจาก POS

**Auto-match rule:**
```
phone_last3 (เบอร์ 3 ตัวท้าย) + total_amount + order_date → POS order
```
- Email: `0983***074` → last3 = `074`
- Email: `訂單總額 NT$550` → `550`
- Email: `訂單日期 2026-06-17` → `2026-06-17`
- POS: เบอร์ `0983179074` → last3 = `074`, total `550`, วันที่สั่ง `2026-06-17`

**Confidence:** สูงมาก — 3 fields ร่วมกันไม่น่าจะ collision ในวันเดียวกัน

### 2.4 Audit Module
- `backend/src/modules/audit/audit-log.entity.ts:1-62`
- มี `AuditAction` enum — ต้องเพิ่ม action ใหม่สำหรับ shipping status updates
- AuditService ใช้งานอยู่ใน OrdersService แล้ว

### 2.5 Auth / RBAC
- Roles: `owner | manager | cashier | staff | admin` (`user.entity.ts:7-13`)
- Shipments controller ใช้ `@Roles(OWNER, MANAGER, STAFF)` (`shipment.controller.ts:17`)

### 2.6 Settings Module
- `store-settings.entity.ts` มี JSONB columns สำหรับ feature config ต่างๆ
- **ไม่มี** field สำหรับ Gmail credentials — ต้องเพิ่ม หรือสร้าง table แยก (เพราะ Gmail tokens เป็น secret)

### 2.7 Dependencies
- ปัจจุบัน backend **ไม่มี** Gmail API client library (`googleapis`)
- ไม่มี cron/scheduler — ต้องเพิ่ม `@nestjs/schedule`

---

## 3. Proposed Behavior

### 3.1 Gmail OAuth2 Setup Flow

```
Owner เข้าหน้า Settings > Gmail Integration
  -> กดปุ่ม "เชื่อมต่อ Gmail"
  -> Redirect ไป Google OAuth2 consent screen
  -> User authorize -> redirect back พร้อม auth code
  -> Backend แลก code เป็น access_token + refresh_token
  -> เก็บ tokens ใน DB (encrypted)
  -> แสดงสถานะ "เชื่อมต่อแล้ว" + email address
```

**Tokens จะถูกเก็บใน table แยก** (`gmail_credentials`) ไม่ใช่ใน `store_settings` เพราะเป็น sensitive data ที่ต้อง encrypt

### 3.2 Email Polling Flow (Cron)

```
ทุก 15 นาที (configurable):
  1. ดึง gmail_credentials ที่ active
  2. ถ้า token หมดอายุ -> refresh ด้วย refresh_token
  3. ค้น Gmail: from:no-reply@sp88.com, after:{last_sync_timestamp}
  4. สำหรับแต่ละ email:
     a. Parse subject -> ระบุ email type (created/shipped/arrived/completed/cancelled/warning/returned)
     b. Parse body -> ดึง CM number, C number (取貨代碼), 訂單日期, เบอร์ 3 ตัวท้าย, ยอดเงิน
     c. บันทึกลง shipping_emails table (idempotent โดยใช้ gmail_message_id)
     d. **Auto-match:** ค้น orders ด้วย phone_last3 + total_amount + order_date
     e. ถ้า match ได้ -> บันทึก CM number + C number ลง shipping_tracking, update order status, log audit
     f. ถ้า match ไม่ได้ -> mark as "unmatched" สำหรับ manual review
  5. Update last_sync_timestamp
```

### 3.3 Status Mapping (Email -> Order)

| Email Subject Pattern | Email Type | Order Status Update | Notes |
|---|---|---|---|
| 訂單成立通知 | `created` | ไม่ update (informational) | บันทึก CM number ลง tracking |
| 賣家完成寄貨訂單通知 | `shipped` | `shipped` | ยืนยันว่าส่งแล้ว |
| 您的訂單(CM...)已送達 | `arrived` | `delivered` | ถึง 7-11 รอลูกค้ารับ |
| 賣家完成取貨訂單通知 | `completed` | `claimed` | ลูกค้ารับของแล้ว |
| 買家訂單取消通知 | `cancelled` | `cancelled` | ยกเลิกโดยผู้ซื้อ |
| 賣家未於3天內取貨 | `warning` | ไม่ update status | แสดง warning badge ใน dashboard |
| 商品未於期限內取貨... | `returned` | ต้องเพิ่ม `returned` status หรือใช้ `cancelled` + reason | คืนสินค้า ต้อง restore stock |

### 3.4 Amount Reconciliation

เมื่อ parse ได้ยอดจาก email:
- `商品總額` (subtotal) เปรียบเทียบกับ `orders.subtotal`
- `運費` (shipping fee) เปรียบเทียบกับ `orders.shipping_fee`
- `訂單總額` (total) เปรียบเทียบกับ `orders.total_amount`

ถ้ายอดไม่ตรง -> บันทึก discrepancy ใน `shipping_emails.amount_mismatch` (JSONB) และแสดง warning ใน dashboard

### 3.5 Frontend Pages

**3.5.1 Shipping Dashboard** (`/shipments` — replace current placeholder)

**Primary workflow: Admin เช็ครายวัน**
- ตาราง: order_no | ชื่อลูกค้า | C number | status | ยอด POS | ยอด 7-11 | match status | confirm
- แต่ละแถวมีปุ่ม **"Copy C Number"** → copy `C72529686308` ส่งลูกค้าได้เลย
- Badge แสดง ✅ ยอดถูก / ⚠️ ยอดไม่ตรง / ❌ match ไม่ได้
- Filter: วันที่ (default = วันนี้), status, match status
- Admin กด **"Confirm"** ต่อ order เพื่อ mark ว่าตรวจแล้ว

**3.5.2 Gmail Settings** (`/settings` > tab Gmail Integration)
- ปุ่ม Connect/Disconnect Gmail
- แสดงสถานะ: connected email, last sync time, next sync time
- Manual sync button (trigger immediate poll)
- Sync history log

**3.5.3 Unmatched Emails Panel**
- แสดง emails ที่ parse แล้วแต่ match ไม่ได้กับ order ใดๆ
- ให้ user เลือก manually match กับ order

---

## 4. Acceptance Criteria

### AC-1: Gmail OAuth2 Connection
```
Given: Owner อยู่ที่หน้า Settings > Gmail Integration และยังไม่เชื่อมต่อ Gmail
When: กดปุ่ม "เชื่อมต่อ Gmail" และ authorize สำเร็จ
Then: ระบบเก็บ tokens, แสดงสถานะ "เชื่อมต่อแล้ว" พร้อม email address
  And: Owner สามารถกดปุ่ม "ยกเลิกการเชื่อมต่อ" ได้

Given: Gmail token หมดอายุ
When: Cron job ทำงาน
Then: ระบบ refresh token อัตโนมัติ, ถ้า refresh ไม่ได้ให้ mark status เป็น "expired" และแสดง warning ใน dashboard
```

### AC-2: Email Parsing & Storage
```
Given: Gmail มี email ใหม่จาก no-reply@sp88.com ที่ยัง sync ไม่ได้
When: Cron job poll Gmail
Then: Email ถูก parse, บันทึกลง shipping_emails table
  And: gmail_message_id ถูกใช้เป็น unique key (idempotent — sync ซ้ำไม่สร้าง duplicate)
  And: ข้อมูล 訂單編號, 取貨代碼, ยอดเงิน ถูก extract ครบ
```

### AC-3: Auto Status Update
```
Given: Email type "arrived" (已送達) ถูก parse สำเร็จ
  And: CM number match กับ order ที่ status = "shipped"
When: System processes email
Then: Order status เปลี่ยนเป็น "delivered"
  And: Audit log ถูกสร้าง (action = SHIPPING_STATUS_UPDATE, old/new status, source = "gmail_sync")
  And: shipping_emails record ถูก mark เป็น "processed"

Given: Email type "cancelled" ถูก parse
  And: CM number match กับ order ที่ status ไม่ใช่ "cancelled"
When: System processes email
Then: Order status เปลี่ยนเป็น "cancelled" พร้อม cancel_reason = "ยกเลิกโดยผู้ซื้อ (from shipping email)"
  And: Stock ถูก restore (ตาม logic เดิมใน OrdersService.cancelOrder)
```

### AC-4: Amount Reconciliation
```
Given: Email มียอด 訂單總額 = NT$550
  And: POS order มี total_amount = NT$500
When: System processes email
Then: shipping_emails.amount_mismatch บันทึก {email_total: 550, pos_total: 500, diff: 50}
  And: Dashboard แสดง warning icon ที่ order นี้
```

### AC-5: Unmatched Emails
```
Given: Email มี CM number ที่ไม่ตรงกับ order ใดๆ ใน POS
When: System processes email
Then: Email ถูกบันทึกเป็น match_status = "unmatched"
  And: แสดงใน Unmatched Emails panel
  And: User สามารถ manually link กับ order ได้
```

### AC-6: RBAC
```
Given: User มี role = "cashier"
When: พยายามเข้าหน้า Gmail Settings หรือ Shipping Dashboard
Then: ไม่มีสิทธิ์ (403)

Given: User มี role = "owner" หรือ "manager"
When: เข้าหน้า Shipping Dashboard
Then: เห็นข้อมูลครบ + สามารถ trigger manual sync ได้
```

### AC-7: Returned Orders
```
Given: Email type "returned" (商品未於期限內取貨) ถูก parse
  And: CM number match กับ order
When: System processes email
Then: Order status เปลี่ยนเป็น "returned" (ถ้าเพิ่ม enum) หรือ "cancelled" + cancel_reason
  And: Stock ถูก restore ตาม logic เดิม
  And: Audit log บันทึกว่าเป็นการคืนสินค้าจาก shipping timeout
```

---

## 5. Task Breakdown

### Phase 1: Database & Backend Foundation

**Task 1.1: Migration — Add shipping tracking fields**
- Layer: Database
- สร้าง migration `008_gmail_shipping_tracker.sql`
- Tables ใหม่: `gmail_credentials`, `shipping_emails`, `shipping_tracking`
- Alter `orders`: เพิ่ม `returned` ใน OrderStatus enum (ถ้าตัดสินใจเพิ่ม — ดู Open Question #1)
- Alter `audit_logs`: เพิ่ม `SHIPPING_STATUS_UPDATE` ใน AuditAction enum
- Dependencies: ไม่มี

**Task 1.2: Gmail Integration Module (Backend)**
- Layer: Backend
- สร้าง module `gmail-integration/`
  - `gmail-integration.module.ts`
  - `gmail.service.ts` — OAuth2 flow, token management, email fetching
  - `gmail.controller.ts` — endpoints สำหรับ OAuth callback, connection status, manual sync
  - `gmail-credentials.entity.ts`
- Dependencies: Task 1.1, ต้องเพิ่ม dependency `googleapis` + `@nestjs/schedule`

**Task 1.3: Shipping Email Parser Service**
- Layer: Backend
- สร้าง service `shipping-email-parser.service.ts`
  - Parse subject -> classify email type
  - Parse body -> extract structured data (regex-based)
  - สร้าง `shipping-email.entity.ts`
- Dependencies: Task 1.1

**Task 1.4: Shipping Sync Service (Orchestrator)**
- Layer: Backend
- สร้าง service `shipping-sync.service.ts`
  - Cron job (ใช้ `@Cron()` decorator จาก `@nestjs/schedule`)
  - Orchestrate: fetch emails -> parse -> match -> update status
  - Handle unmatched, mismatched amounts
- สร้าง `shipping-tracking.entity.ts` (mapping CM... -> order_id)
- Dependencies: Task 1.2, 1.3

**Task 1.5: Extend Shipment & Order Services**
- Layer: Backend
- เพิ่ม endpoints สำหรับ shipping dashboard data
- เพิ่ม manual match endpoint
- เพิ่ม reconciliation summary endpoint
- Dependencies: Task 1.4

### Phase 2: Frontend

**Task 2.1: Gmail Settings UI**
- Layer: Frontend
- เพิ่ม tab ใน `/settings` สำหรับ Gmail connection
- OAuth2 redirect flow
- Dependencies: Task 1.2

**Task 2.2: Shipping Dashboard Page**
- Layer: Frontend
- Replace placeholder ที่ `/shipments`
- ตาราง + filters + status badges
- Dependencies: Task 1.5

**Task 2.3: Unmatched Emails Panel**
- Layer: Frontend
- Panel ใน shipping dashboard สำหรับ manual matching
- Dependencies: Task 2.2

### Phase 3: Polish

**Task 3.1: Error Handling & Retry Logic**
- Gmail API rate limiting, token refresh failures
- Email parse failures (unexpected format)

**Task 3.2: Testing**
- Unit tests สำหรับ email parser (ใช้ sample email HTML)
- Integration tests สำหรับ sync flow

---

## 6. Data & Schema Impact

### 6.1 New Table: `gmail_credentials`
```sql
CREATE TABLE gmail_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      VARCHAR(50) NOT NULL DEFAULT 'default',
  email_address VARCHAR(255) NOT NULL,
  access_token  TEXT NOT NULL,          -- encrypted
  refresh_token TEXT NOT NULL,          -- encrypted
  token_expiry  TIMESTAMPTZ NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | expired | revoked
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id)
);
```

### 6.2 New Table: `shipping_emails`
```sql
CREATE TABLE shipping_emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id  VARCHAR(255) NOT NULL UNIQUE,   -- idempotency key
  email_type        VARCHAR(30) NOT NULL,            -- created|shipped|arrived|completed|cancelled|warning|returned
  subject           TEXT NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL,
  -- Parsed fields
  cm_order_number   VARCHAR(50),                     -- CM2606170063142
  c_number          VARCHAR(50),                     -- C72529686308 (交貨便服務代碼) — ลูกค้าใช้ track
  order_date        DATE,
  phone_last3       VARCHAR(3),                      -- 3 ตัวท้ายของเบอร์ลูกค้า (สำหรับ matching)
  payment_method    VARCHAR(30),                     -- 取貨付款 etc.
  delivery_method   VARCHAR(100),                    -- 店取：7-ELEVEN-冷凍
  subtotal          DECIMAL(10,2),
  shipping_fee      DECIMAL(10,2),
  total_amount      DECIMAL(10,2),
  -- Matching (phone_last3 + total_amount + order_date)
  matched_order_id  UUID REFERENCES orders(id),
  match_status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|matched|unmatched|manual
  amount_mismatch   JSONB,                           -- {email_total, pos_total, diff, fields:[]}
  admin_confirmed   BOOLEAN NOT NULL DEFAULT FALSE,  -- admin กด Confirm แล้ว
  confirmed_at      TIMESTAMPTZ,
  -- Processing
  process_status    VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|processed|skipped|error
  process_error     TEXT,
  processed_at      TIMESTAMPTZ,
  -- Meta
  raw_body          TEXT,                            -- original email body for debugging
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_emails_cm ON shipping_emails(cm_order_number);
CREATE INDEX idx_shipping_emails_match ON shipping_emails(match_status);
CREATE INDEX idx_shipping_emails_type ON shipping_emails(email_type);
```

### 6.3 New Table: `shipping_tracking`
```sql
CREATE TABLE shipping_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  cm_order_number VARCHAR(50),                       -- CM number จาก 7-11 (auto-populated หลัง match)
  c_number        VARCHAR(50),                       -- C number = ลูกค้าใช้ track (交貨便服務代碼)
  carrier         VARCHAR(30) NOT NULL DEFAULT 'seven_eleven',
  current_status  VARCHAR(30) NOT NULL DEFAULT 'created',
  status_history  JSONB NOT NULL DEFAULT '[]',       -- [{status, timestamp, email_id}]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cm_order_number),
  UNIQUE(order_id)
);

-- Index สำหรับ C number (admin copy ส่งลูกค้า)
CREATE INDEX idx_shipping_tracking_c_number ON shipping_tracking(c_number);

CREATE INDEX idx_shipping_tracking_order ON shipping_tracking(order_id);
```

### 6.4 Enum Updates
```sql
-- เพิ่ม 'returned' ใน order status enum (ถ้าตัดสินใจเพิ่ม)
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'returned';

-- เพิ่ม audit action
ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'SHIPPING_STATUS_UPDATE';
ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'GMAIL_SYNC';
```

### 6.5 Multi-tenancy
ปัจจุบันระบบเป็น single-store (`store_id = 'default'`) ดังนั้น `gmail_credentials` ใช้ `store_id` เป็น unique key เพียงพอ ไม่ต้องทำ multi-tenant ซับซ้อน

---

## 7. Risks & Open Questions

### Open Questions (ต้องตัดสินใจก่อน implement)

**OQ-1: จะเพิ่ม `returned` status ใน OrderStatus enum ไหม?**
- Option A: เพิ่ม `returned` เป็น status ใหม่ — ชัดเจน, แยก semantics จาก `cancelled`
- Option B: ใช้ `cancelled` + `cancel_reason = "returned_by_shipping"` — ไม่ต้องแก้ enum แต่ semantics ไม่ชัด
- **Recommendation:** Option A — เพราะ `returned` มี business logic ต่างจาก `cancelled` (ต้อง restore stock + อาจต้องติดตามสินค้าคืน)

**OQ-2: CM number ได้มาตอนไหน? ✅ RESOLVED**
- CM number เกิดจากระบบ sp88 แยกจาก POS
- **ไม่ใช้ CM number เป็น key match** — ใช้ phone_last3 + amount + date แทน
- หลัง match สำเร็จ ระบบจะ save CM number + C number ไว้ใน shipping_tracking อัตโนมัติ

**OQ-3: Google Cloud Project setup — ใครทำ?**
- ต้องสร้าง project ใน Google Cloud Console, enable Gmail API, สร้าง OAuth2 credentials
- ใช้ scope: `https://www.googleapis.com/auth/gmail.readonly`
- **ต้อง:** สร้าง Google Cloud Project + OAuth consent screen (production ต้อง verify กับ Google)
- ระหว่าง dev ใช้ "Testing" mode ได้ (จำกัด 100 users)

**OQ-4: Email body format — HTML หรือ plain text?**
- ต้องดูตัวอย่าง email จริงเพื่อเขียน parser ที่ถูกต้อง
- **ต้องการ:** ตัวอย่าง raw email (HTML source) สำหรับทุก 7 types เพื่อเขียน parser

**OQ-5: Encryption ของ Gmail tokens**
- Access token + refresh token เป็น sensitive data
- ต้องเข้ารหัสก่อนเก็บใน DB
- **Option:** ใช้ AES-256-GCM encrypt ด้วย key จาก environment variable
- **ต้องถาม:** มี encryption util อยู่ในระบบแล้วไหม? (จากการสำรวจ ไม่พบ)

**OQ-6: Rate limiting ของ Gmail API**
- Gmail API quota: 250 units/second (per user), 1 message read = 5 units
- Poll ทุก 15 นาที น่าจะไม่เกิน quota
- แต่ถ้า backlog มาก (sync ครั้งแรก) อาจต้อง paginate

**OQ-7: ถ้า email มาก่อน order ถูกสร้างใน POS?**
- เป็นไปได้ถ้าเจ้าของร้านสร้าง order ใน sp88 ก่อนแล้วค่อยสร้างใน POS ทีหลัง
- email จะถูก mark เป็น "unmatched" แล้วเมื่อ order ถูกสร้างและ link CM number ระบบควร retroactively match ไหม?
- **Recommendation:** ใช่ — เมื่อ user link CM number กับ order ให้ re-process unmatched emails ที่มี CM number ตรงกัน

### Risks

**R-1: Email format เปลี่ยน**
- sp88.com อาจเปลี่ยน email template โดยไม่แจ้ง ทำให้ parser พัง
- **Mitigation:** เก็บ raw email body, มี fallback เมื่อ parse ไม่ได้ (mark as `error` ไม่ crash), monitor parse failure rate

**R-2: Google OAuth token revocation**
- User อาจ revoke access จาก Google Account settings
- **Mitigation:** Handle 401 errors gracefully, mark credential as `revoked`, แสดง warning ใน UI

**R-3: New dependency risk**
- ต้องเพิ่ม `googleapis` (~15MB) และ `@nestjs/schedule`
- **ต้องได้รับอนุมัติ** ตาม project constraint "ห้ามเพิ่ม dependency ใหม่โดยไม่ถามก่อน"
- ทั้งสอง packages เป็น well-maintained, widely used

**R-4: Stock restoration on "returned"**
- ถ้า order ถูก return จาก shipping ต้อง restore stock
- Logic นี้มีอยู่แล้วใน `OrdersService.cancelOrder()` (`orders.service.ts:366-405`) แต่ต้องตรวจสอบว่ารองรับ case ที่ stock ถูก deduct ไปแล้ว (status = shipped) ไม่ใช่แค่ reserved
- **Specific concern:** `cancelOrder` line 381 ตรวจ `oldStatus === PENDING` สำหรับ online orders แต่ returned order จะมี status เป็น `delivered` — ต้องเพิ่ม logic สำหรับ case นี้

**R-5: Duplicate processing**
- Email อาจถูก process ซ้ำถ้า cron overlap
- **Mitigation:** ใช้ `gmail_message_id` เป็น unique constraint + check `process_status` ก่อน process

---

## Appendix: New Dependencies Required (ต้องขออนุมัติ)

| Package | Purpose | Size | Maintenance |
|---|---|---|---|
| `googleapis` | Gmail API client (OAuth2 + messages) | ~15MB | Google-maintained |
| `@nestjs/schedule` | Cron job scheduling | ~50KB | NestJS official |
| `@types/cron` | TypeScript types for schedule | ~10KB | Dev dependency |
