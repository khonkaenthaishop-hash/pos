# Customer Order Module - Feature Specification

> Version: 1.1 | Date: 2026-06-21
> Status: CONFIRMED — decisions finalized

---

## 1. Goal & Scope

### Problem Statement

Admin (based in Thailand) receives orders from customers via Facebook Messenger, then manually:
1. Chats with each customer one-by-one to collect order details (slow, customers drop off)
2. Summarizes the order as plain text and sends it back for confirmation
3. Records the order in Google Sheets (not integrated with POS)
4. Staff in Taiwan manually enters delivery info into 7-11/Family Mart systems (error-prone)

### Goal

Build a self-service order form that customers access via a link shared in Messenger. The customer selects products, fills delivery info, and the system generates a formatted order summary that is automatically sent back into the Messenger conversation. Admin then reviews and confirms the order in the POS back-office.

### Who It's For

| Actor      | Role in Flow                                                      |
| ---------- | ----------------------------------------------------------------- |
| Customer   | Selects products + enters delivery info via public link (no auth) |
| Admin      | Shares link in Messenger, reviews/edits, confirms order in POS   |
| Staff (TW) | Reads confirmed orders for packing/shipping                      |

### In Scope

- Public customer order form (Next.js public route, no login)
- Session token mechanism to link form submission to a Messenger conversation (PSID)
- Product catalog view (from existing `products` table, active + approved only)
- Delivery info collection with carrier-specific fields (7-11, Family Mart, Black Cat)
- Order summary generation in the exact text format currently used by admin
- Facebook Send API integration to push summary back to Messenger
- Admin review page in POS back-office (pending customer orders queue)
- Admin confirm/edit/reject flow that creates a real `orders` record
- New `customer_orders` staging table (draft orders before admin confirmation)

### Out of Scope

- Customer login/registration (customers are anonymous, identified only by PSID)
- Payment processing (payment is COD or bank transfer, handled outside system)
- Automatic stock reservation at customer submission (reserved only when admin confirms)
- OK Mart, Hi-Life, Taiwan Post carriers (only 7-11, Family Mart, Black Cat per requirements)
- Customer order history page
- Multi-language customer form (Thai only for v1 — customers are Thai speakers)

### Chatbot Strategy (Confirmed)

ใช้ **2 ระบบร่วมกัน** แบ่งหน้าที่ชัดเจน:

| ระบบ | หน้าที่ | หมายเหตุ |
|---|---|---|
| **Meta Business Agent** | ตอบคำถามทั่วไป — สินค้า, ราคา, นโยบาย, ข้อมูลร้าน | มีอยู่แล้ว ปรับ knowledge base เพิ่ม |
| **Custom Webhook** | Actions ที่ต้องการ real-time data จาก POS | Build ใหม่ |

**Custom Webhook handles:**
1. ลูกค้าส่งข้อความครั้งแรก → จับ PSID → ส่ง order link อัตโนมัติ
2. keyword `เลขพัสดุ` / `tracking` / `ติดตาม` → query C number + status → reply
3. ลูกค้า submit order form → ส่ง summary กลับ chat + notify admin
4. keyword `เคลม` / `คืน` → tag + alert admin ทันที
5. อื่นๆ → ไม่ตอบ (ปล่อย Meta Business Agent จัดการ)

---

## 2. Current-State Analysis

### 2.1 Orders Module

The system already supports online orders. Key files:

- **Entity:** `backend/src/modules/orders/order.entity.ts` (lines 1-203)
  - `OrderType` enum has `ONLINE = 'online'` (line 17)
  - `OrderStatus` enum: `PENDING | CONFIRMED | PACKING | SHIPPED | DELIVERED | CANCELLED | CLAIMED` (lines 20-28)
  - `CarrierName` enum: `SEVEN_ELEVEN | FAMILY_MART | OK_MART | HILIFE | BLACK_CAT | POST` (lines 38-45)
  - Order has: `carrier`, `temperature`, `packageSize`, `shippingFee`, `orderNickname`, `customerName`, `customerId`, `shippingAddressId` (lines 111-121)
  - **Missing:** No fields for branch code, recipient name, recipient phone, or full delivery address on the order itself. `shippingAddressId` exists but there is no `shipping_addresses` table.

- **Service:** `backend/src/modules/orders/orders.service.ts` (lines 296-363)
  - `createOnlineOrder()` already creates `ONLINE` + `PENDING` orders, reserves stock, and logs audit
  - Accepts `CreateOnlineOrderDto` with items, carrier, temperature, shippingFee, paymentMethod

- **Controller:** `backend/src/modules/orders/orders.controller.ts` (lines 93-97)
  - `POST /orders/online` is guarded by `@Roles(OWNER, MANAGER, ADMIN)` -- only internal users can create
  - No public (unauthenticated) endpoint exists

### 2.2 Products Module

- **Entity:** `backend/src/modules/products/product.entity.ts` (lines 1-162)
  - Products have: `nameTh`, `nameZh`, `retailPrice`, `imageUrl`, `isActive`, `isApproved`, `currentStock`, `reservedStock`, `temperatureType`, `categoryId`
  - `availableStock` getter: `currentStock - reservedStock` (line 160)

- **Service:** `backend/src/modules/products/products.service.ts`
  - `findAll()` supports filtering by search, category, pagination (lines 28-73)
  - `reserveStock()` checks available stock and increments `reservedStock` (lines 361-367)

### 2.3 Customers Module

- **Entity:** `backend/src/modules/customers/customer.entity.ts` (lines 1-49)
  - Has `facebookId` field (line 24) -- can store Facebook PSID
  - Has `name`, `nickname`, `phone`, `totalOrders`, `totalSpent`
  - **Missing:** No address fields, no delivery preferences

### 2.4 Carriers Module

- **Backend:** `backend/src/modules/carriers/carriers.module.ts` -- static carrier data with rates
- **Frontend:** `frontend/src/constants/carriers.ts` -- detailed carrier config including rates, tracking URLs, COD rules

### 2.5 Frontend Routing & Auth

- **Middleware:** `frontend/src/middleware.ts` (lines 1-27)
  - ALL routes except `/login` require authentication
  - No exclusion for public routes -- **must be updated** to allow `/order/*` public routes
  
- **Online Orders page:** `frontend/src/app/(main)/online-orders/page.tsx` -- placeholder "coming soon" page

- **API Client:** `frontend/src/lib/api.ts` -- axios-based, always attaches JWT token. Public endpoints will need a separate axios instance (no auth).

### 2.6 Audit Module

- **Entity:** `backend/src/modules/audit/audit-log.entity.ts`
  - `AuditAction` enum includes `ORDER_CREATE` (line 10)
  - Online order creation already logs audit (orders.service.ts:352-358)

### 2.7 Schema Gaps

The current schema is missing:
1. **Delivery/shipping details storage** -- `orders.shippingAddressId` references nothing
2. **Customer order staging** -- no way to hold a draft from an unauthenticated customer
3. **Facebook PSID-to-session mapping** -- no mechanism to link a form URL to a Messenger conversation
4. **Branch info** -- no field for convenience store branch code/name

---

## 3. Proposed Behavior

### 3.1 Facebook Webhook Architecture

```
Messenger Event
      ↓
POST /webhook/facebook (public endpoint)
      ├── verify_token check (GET, one-time setup)
      ├── event.type = message
      │     ├── extract PSID จาก sender.id
      │     ├── is_first_contact? → สร้าง session + ส่ง order link
      │     ├── keyword "เลขพัสดุ/tracking/ติดตาม" → query C number → Send API reply
      │     ├── keyword "เคลม/คืน" → save flag + notify admin
      │     └── else → ไม่ตอบ (Meta Business Agent จัดการ)
      └── event.type = other → ignore
```

**Facebook App Requirements:**
- Permission: `pages_messaging`, `pages_read_engagement`
- Webhook subscriptions: `messages`, `messaging_postbacks`
- Send API: `POST https://graph.facebook.com/v19.0/me/messages`

### 3.2 End-to-End Order Flow

```
Customer (Messenger)          System (Webhook + POS)          Admin (POS Dashboard)
      |                               |                               |
      |-- ส่งข้อความใดก็ได้ -------->|                               |
      |                               |-- จับ PSID                   |
      |                               |-- สร้าง session token        |
      |<-- ส่ง order link อัตโนมัติ --|                               |
      |    shop.pos.com/order/{token} |                               |
      |                               |                               |
      |-- เปิด link ----------------->|                               |
      |<-- product catalog page ------|                               |
      |                               |                               |
      |-- เลือกสินค้า + กรอก info --->|                               |
      |-- กด Submit ----------------->|                               |
      |                               |-- สร้าง customer_order_draft  |
      |                               |-- format summary text        |
      |<-- แสดง summary + "รอ confirm"|-- Send API → summary -------->| (เห็นใน Messenger)
      |                               |-- notify admin (in-app) ---->|
      |                               |                               |-- เปิด Pending Orders
      |                               |                               |-- review/แก้ไข
      |                               |                               |-- กด Confirm
      |                               |<-- createOnlineOrder() -------|
      |                               |-- reserve stock              |
      |                               |-- audit log                  |
      |<-- "ออเดอร์ของคุณ confirmed!" |                               |
```

### 3.3 Session Token

- Token: `crypto.randomUUID()` (ฝังใน URL)
- เก็บใน `customer_order_sessions` table พร้อม `psid`, `status`, `expires_at`
- หมดอายุใน 24 ชั่วโมง
- 1 token = 1 customer conversation (ไม่ reuse)

### 3.4 Customer Order Form (Public Page)

**Route:** `/order/[token]` -- outside `(main)` layout, no auth required

**Step 1: Product Selection**
- Shows active + approved products from POS catalog, grouped by category
- Each product shows: image (if available), Thai name, retail price, unit
- Customer can search/filter by name
- Customer adds items to cart with quantity
- Running subtotal displayed

**Step 2: Delivery Info**
- Customer selects carrier: 7-11 / Family Mart / Black Cat
- Form fields change based on carrier selection:

| Field                    | 7-11 | Family Mart | Black Cat |
| ------------------------ | ---- | ----------- | --------- |
| Facebook name (order)    | Y    | Y           | Y         |
| Recipient real name      | Y    | Y           | Y (zh/en) |
| Phone                    | Y    | Y           | Y         |
| Branch code OR name      | Y    | Y           | N         |
| Delivery address         | N    | N           | Y         |
| Temperature (cold/normal)| Y    | Y           | Y         |
| Payment (COD/transfer)   | Y    | Y           | Y         |
| Need house number photo  | N    | N           | Optional  |

**Step 3: Review & Submit**
- Shows order summary in the formatted text style
- Customer can go back and edit
- Submit button creates the staging record

### 3.5 Order Summary Text Generation

The system must produce text matching the exact format admin currently uses. The format varies by carrier:

**7-11 Format:**
```
{DD/MM/YY buddhist era}

{product_name_th} {qty}*{price}={line_total}
...
ค่าส่ง {shipping_fee} {เย็น|ธรรมดา}
รวม {grand_total}

ส่ง 7-11
ออเดอร์ {facebook_name}
{recipient_name}
{phone}
7-11: {branch_code_or_name}
```

**Family Mart Format:**
```
{DD/MM/YY buddhist era}

{product_name_th} {qty}*{price}={line_total}
...
ค่าส่ง {shipping_fee} {เย็น|ธรรมดา}
รวม {grand_total}

ส่งแฟมิลี่
ออเดอร์ {facebook_name}
{recipient_name}
{phone}
{branch_code_and_name}
```

**Black Cat Format:**
```
{DD/MM/YY buddhist era}
ออร์เดอร์ {facebook_name}

{product_name_th} {qty}*{price}={line_total}
...
ค่าส่ง {shipping_fee} {เย็น|ธรรมดา}
รวม {grand_total}

ส่งแมวดำ
{recipient_name} {phone}
{delivery_address}
```

**Date format:** DD/MM/YY in Buddhist Era (Gregorian year + 543, last 2 digits). Example: 2026-06-20 = 20/06/69

**Line item format:** When qty > 1: `{name} {qty}*{price}={total}`. When qty = 1: `{name} {price}`

**Payment note:** If COD, no extra note needed (default). If transfer, append payment info per business rules (open question -- see section 9).

### 3.5 Facebook Send API Integration

When the session has a valid PSID:
1. After customer submits, backend calls Facebook Graph API:
   ```
   POST https://graph.facebook.com/v18.0/{PAGE_ID}/messages
   {
     "recipient": { "id": "{PSID}" },
     "message": { "text": "{order_summary_text}" },
     "messaging_type": "RESPONSE"
   }
   ```
2. Requires a valid **Page Access Token** with `pages_messaging` permission
3. Token stored as environment variable `FACEBOOK_PAGE_ACCESS_TOKEN`
4. `PAGE_ID` stored as environment variable `FACEBOOK_PAGE_ID`

**Messaging Policy Constraint:** Facebook only allows sending messages within 24 hours of the last customer message. Since admin is sharing the link during an active conversation, this window should be open. If the API returns a 551 error (outside window), the system logs the error and still saves the order -- admin sees a warning "could not send to Messenger" in the POS review queue.

### 3.6 Admin Review Flow (POS Back-Office)

**Route:** `/online-orders` (replace current placeholder)

**Pending Customer Orders Queue:**
- Lists all `customer_order_sessions` with status `submitted`
- Shows: date, Facebook name, carrier, item count, total amount
- Click to open detail view

**Detail View:**
- Shows full order summary text (preview)
- Editable fields: items (add/remove/change qty/price), shipping fee, carrier, delivery info
- Action buttons:
  - **Confirm** -- creates real `orders` record via existing `createOnlineOrder()`, updates session status to `confirmed`
  - **Reject** -- sets session status to `rejected`, optionally sends rejection message to Messenger

### 3.7 Shipping Fee Calculation

Shipping fee is NOT auto-calculated from carrier rates in this version. Admin sets the shipping fee when confirming (they know the actual weight/size). The customer form shows an estimated fee based on carrier rates from `frontend/src/constants/carriers.ts`, but admin can override.

---

## 4. Data & Schema Impact

### 4.1 New Table: `customer_order_sessions`

```sql
CREATE TABLE customer_order_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         VARCHAR(64) NOT NULL UNIQUE,
  
  -- Facebook context
  psid          VARCHAR(100),          -- Facebook Page-Scoped User ID (nullable if not provided)
  facebook_name VARCHAR(200),          -- Customer's Facebook display name
  
  -- Admin who generated the link
  admin_id      UUID NOT NULL REFERENCES users(id),
  
  -- Order data (filled by customer)
  items         JSONB,                 -- Array of {productId, productNameTh, unitPrice, quantity}
  subtotal      DECIMAL(10,2) DEFAULT 0,
  shipping_fee  DECIMAL(10,2) DEFAULT 0,
  total_amount  DECIMAL(10,2) DEFAULT 0,
  
  -- Delivery info
  carrier           VARCHAR(20),       -- seven_eleven | family_mart | black_cat
  temperature       VARCHAR(10) DEFAULT 'normal',  -- normal | cold
  payment_method    VARCHAR(10) DEFAULT 'cod',     -- cod | transfer
  recipient_name    VARCHAR(200),
  recipient_phone   VARCHAR(20),
  branch_code       VARCHAR(100),      -- 7-11 / FamilyMart branch code
  branch_name       VARCHAR(200),      -- 7-11 / FamilyMart branch name
  delivery_address  TEXT,              -- Black Cat full address
  need_house_photo  BOOLEAN DEFAULT FALSE,
  
  -- Generated output
  summary_text  TEXT,                  -- The formatted order summary
  
  -- Lifecycle
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',  
                -- pending (link created, not yet submitted)
                -- submitted (customer submitted)
                -- confirmed (admin confirmed, real order created)
                -- rejected (admin rejected)
                -- expired (token expired without submission)
  
  order_id      UUID REFERENCES orders(id),  -- Set when confirmed, links to real order
  
  -- Messenger integration
  messenger_sent     BOOLEAN DEFAULT FALSE,
  messenger_error    TEXT,
  
  note          TEXT,
  
  expires_at    TIMESTAMPTZ NOT NULL,
  submitted_at  TIMESTAMPTZ,
  confirmed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cos_token ON customer_order_sessions(token);
CREATE INDEX idx_cos_status ON customer_order_sessions(status);
CREATE INDEX idx_cos_admin ON customer_order_sessions(admin_id);
CREATE INDEX idx_cos_psid ON customer_order_sessions(psid);
CREATE INDEX idx_cos_expires ON customer_order_sessions(expires_at);
```

### 4.2 Existing Table Changes

**No changes to existing tables.** The delivery details (recipient name, phone, branch, address) are stored in `customer_order_sessions`. When admin confirms, the relevant info is copied into the `orders.note` field as the formatted summary text, and carrier/temperature/shippingFee are set on the order directly.

### 4.3 Migration File

New file: `backend/database/migrations/008_customer_order_sessions.sql`

### 4.4 Multi-tenancy / Scoping

This system is single-tenant (one store). No multi-tenancy implications.

---

## 5. API Endpoints

### 5.1 Internal (Authenticated) Endpoints

All under `@UseGuards(JwtAuthGuard, RolesGuard)`.

| Method | Path                                     | Roles                  | Description                            |
| ------ | ---------------------------------------- | ---------------------- | -------------------------------------- |
| POST   | `/api/v1/customer-orders/sessions`       | owner, manager, admin  | Create session + generate link         |
| GET    | `/api/v1/customer-orders/sessions`       | owner, manager, admin  | List sessions (filterable by status)   |
| GET    | `/api/v1/customer-orders/sessions/:id`   | owner, manager, admin  | Get session detail                     |
| PATCH  | `/api/v1/customer-orders/sessions/:id/confirm` | owner, manager, admin | Confirm -> creates real order    |
| PATCH  | `/api/v1/customer-orders/sessions/:id/reject`  | owner, manager, admin | Reject session                   |
| PATCH  | `/api/v1/customer-orders/sessions/:id`   | owner, manager, admin  | Edit session (items, delivery info)    |

**POST /customer-orders/sessions** - Request:
```json
{
  "psid": "1234567890",        // optional
  "facebookName": "ความเฉยชา คือ การบอกลา"  // optional
}
```
Response:
```json
{
  "id": "uuid",
  "token": "abc123...",
  "url": "https://domain.com/order/abc123...",
  "expiresAt": "2026-06-22T12:00:00Z"
}
```

**PATCH /customer-orders/sessions/:id/confirm** - Request:
```json
{
  "items": [...],          // optional override
  "shippingFee": 150,      // optional override
  "note": "..."            // optional
}
```
Response: The created `Order` object.

### 5.2 Public (No Auth) Endpoints

These endpoints are NOT behind `JwtAuthGuard`. They validate via session token.

| Method | Path                                          | Description                         |
| ------ | --------------------------------------------- | ----------------------------------- |
| GET    | `/api/v1/public/order-sessions/:token`        | Get session info + product catalog  |
| POST   | `/api/v1/public/order-sessions/:token/submit` | Submit customer's order             |

**GET /public/order-sessions/:token** - Response:
```json
{
  "session": {
    "id": "uuid",
    "facebookName": "...",
    "status": "pending",
    "expiresAt": "..."
  },
  "products": [
    {
      "id": "uuid",
      "nameTh": "ปูดองครึ่งโล",
      "nameZh": "...",
      "retailPrice": 380,
      "imageUrl": "...",
      "unit": "ชิ้น",
      "categoryId": "...",
      "categoryName": "อาหารทะเล",
      "temperatureType": "cold",
      "inStock": true
    }
  ],
  "carriers": [
    { "key": "seven_eleven", "name": "7-Eleven", "hasCold": true },
    { "key": "family_mart", "name": "Family Mart", "hasCold": true },
    { "key": "black_cat", "name": "แมวดำ (Black Cat)", "hasCold": true }
  ]
}
```

**POST /public/order-sessions/:token/submit** - Request:
```json
{
  "items": [
    { "productId": "uuid", "quantity": 2 },
    { "productId": "uuid", "quantity": 1 }
  ],
  "carrier": "seven_eleven",
  "temperature": "cold",
  "paymentMethod": "cod",
  "facebookName": "ความเฉยชา คือ การบอกลา",
  "recipientName": "Apiwan",
  "recipientPhone": "0981281774",
  "branchCode": "265292",
  "branchName": "",
  "deliveryAddress": "",
  "needHousePhoto": false
}
```
Response:
```json
{
  "success": true,
  "summaryText": "20/06/69\n\nปูดองครึ่งโล 2*380=760\n...",
  "messengerSent": true
}
```

### 5.3 Validation Rules

| Field          | Validation                                                        |
| -------------- | ----------------------------------------------------------------- |
| items          | At least 1 item, each with valid productId and quantity >= 1      |
| carrier        | Must be `seven_eleven`, `family_mart`, or `black_cat`             |
| temperature    | Must be `normal` or `cold`                                        |
| paymentMethod  | Must be `cod` or `transfer`                                       |
| facebookName   | Required, max 200 chars                                           |
| recipientName  | Required, max 200 chars                                           |
| recipientPhone | Required, 8-15 digits                                             |
| branchCode     | Required if carrier is 7-11 or Family Mart (when branchName empty)|
| deliveryAddress| Required if carrier is Black Cat                                  |
| token          | Must exist, not expired, status must be `pending`                 |

---

## 6. Frontend Pages / Components

### 6.1 Public Customer Form

**Route:** `frontend/src/app/order/[token]/page.tsx` (outside `(main)` and `(auth)` route groups)

**Middleware update required:** `frontend/src/middleware.ts` must exclude `/order/*` from auth redirect.

**Components:**

| Component                     | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `OrderFormLayout`             | Minimal layout (store logo, no sidebar/nav)        |
| `ProductCatalog`              | Grid of products, search, category filter          |
| `ProductCard`                 | Product image, name, price, add-to-cart button      |
| `CartSummary`                 | Floating cart showing selected items + subtotal     |
| `DeliveryForm`                | Carrier selection + dynamic fields per carrier      |
| `CarrierSelector`             | Radio/card selector for 3 carriers                 |
| `SevenElevenFields`           | Branch code, name, temperature, payment fields     |
| `FamilyMartFields`            | Branch code, name, temperature, payment fields     |
| `BlackCatFields`              | Address, temperature, payment, house photo toggle  |
| `OrderReviewStep`             | Shows formatted summary text, confirm/back buttons |
| `OrderSubmittedPage`          | Success state with summary display                 |
| `OrderExpiredPage`            | Error state when token is expired/invalid          |

**Separate API client:** A new `publicApi` axios instance without auth interceptor. File: `frontend/src/lib/publicApi.ts`

### 6.2 Admin: Customer Orders Management

**Route:** Enhance existing `frontend/src/app/(main)/online-orders/page.tsx`

**Components:**

| Component                     | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `CustomerOrdersQueue`         | Table of pending/submitted sessions                |
| `CustomerOrderDetail`         | Full detail with editable items + delivery info    |
| `GenerateLinkDialog`          | Modal to create new session link (with PSID input) |
| `OrderSummaryPreview`         | Read-only formatted text preview                   |
| `ConfirmOrderDialog`          | Confirmation modal with shipping fee override      |

### 6.3 Frontend API Client Additions

In `frontend/src/lib/api.ts`, add:
```typescript
export const customerOrdersApi = {
  createSession: (data: Record<string, unknown>) =>
    api.post('/customer-orders/sessions', data),
  listSessions: (params?: Record<string, unknown>) =>
    api.get('/customer-orders/sessions', { params }),
  getSession: (id: string) =>
    api.get(`/customer-orders/sessions/${id}`),
  confirmSession: (id: string, data?: Record<string, unknown>) =>
    api.patch(`/customer-orders/sessions/${id}/confirm`, data),
  rejectSession: (id: string, data?: Record<string, unknown>) =>
    api.patch(`/customer-orders/sessions/${id}/reject`, data),
  updateSession: (id: string, data: Record<string, unknown>) =>
    api.patch(`/customer-orders/sessions/${id}`, data),
};
```

In `frontend/src/lib/publicApi.ts` (new file):
```typescript
export const publicOrderApi = {
  getSession: (token: string) =>
    publicApi.get(`/public/order-sessions/${token}`),
  submit: (token: string, data: Record<string, unknown>) =>
    publicApi.post(`/public/order-sessions/${token}/submit`, data),
};
```

---

## 7. Acceptance Criteria

### AC-1: Link Generation

**Given** an admin user is logged into the POS
**When** they click "Generate Order Link" and optionally enter a PSID
**Then** the system creates a `customer_order_session` with status `pending`, a unique token, and expiry 24h from now, and returns a copyable URL

### AC-2: Customer Accesses Valid Link

**Given** a customer opens a valid, non-expired order link
**When** the page loads
**Then** they see the product catalog with active+approved products, prices, and images

### AC-3: Customer Accesses Expired/Invalid Link

**Given** a customer opens an expired or invalid token URL
**When** the page loads
**Then** they see a friendly error message "Link expired or invalid" with no product catalog

### AC-4: Customer Selects Products

**Given** a customer is on the order form
**When** they add products to the cart and adjust quantities
**Then** the running subtotal updates correctly, showing `qty * price` per line

### AC-5: Carrier-Specific Fields (7-11)

**Given** a customer selects 7-11 as carrier
**When** the delivery form renders
**Then** fields shown are: Facebook name, recipient name, phone, branch code/name, temperature (cold/normal), payment method (COD/transfer)

### AC-6: Carrier-Specific Fields (Family Mart)

**Given** a customer selects Family Mart as carrier
**When** the delivery form renders
**Then** fields shown are: Facebook name, recipient name, phone, branch code/name, temperature (cold/normal), payment method (COD/transfer)

### AC-7: Carrier-Specific Fields (Black Cat)

**Given** a customer selects Black Cat as carrier
**When** the delivery form renders
**Then** fields shown are: Facebook name, recipient name (Chinese/English), phone, delivery address, temperature (cold/normal), payment method (COD/transfer), need house photo checkbox

### AC-8: Order Summary Format (7-11)

**Given** a customer submits an order with carrier=7-11, items=[{name:"ปูดองครึ่งโล", qty:2, price:380}, {name:"น้ำจิ้มแจ่วฮ้อน", qty:1, price:290}], shipping=150 cold, facebook="ความเฉยชา คือ การบอกลา", recipient="Apiwan", phone="0981281774", branch="265292"
**When** the system generates the summary
**Then** the output matches:
```
{DD/MM/YY}

ปูดองครึ่งโล 2*380=760
น้ำจิ้มแจ่วฮ้อน 290
ค่าส่ง 150 เย็น
รวม 1,200

ส่ง 7-11
ออเดอร์ ความเฉยชา คือ การบอกลา
Apiwan
0981281774
7-11: 265292
```

### AC-9: Order Summary Format (Family Mart)

**Given** a customer submits a Family Mart order
**When** the system generates the summary
**Then** the carrier section reads `ส่งแฟมิลี่` and branch info shows without prefix

### AC-10: Order Summary Format (Black Cat)

**Given** a customer submits a Black Cat order
**When** the system generates the summary
**Then** the format shows `ออร์เดอร์ {name}` on the second line, `ส่งแมวดำ` as carrier label, and recipient+phone on one line followed by address

### AC-11: Facebook Messenger Send

**Given** a session has a valid PSID and Facebook API credentials are configured
**When** the customer submits the order
**Then** the summary text is sent to the PSID via Facebook Send API, `messenger_sent` is set to `true`

### AC-12: Facebook Send Failure

**Given** the Facebook Send API returns an error (e.g., 551 outside messaging window)
**When** the customer submits the order
**Then** the order is still saved with `messenger_sent=false` and `messenger_error` populated, the customer sees the summary on-screen, and admin sees a warning in the review queue

### AC-13: Admin Sees Pending Orders

**Given** there are submitted customer order sessions
**When** admin navigates to Online Orders page
**Then** they see a list of pending sessions with date, Facebook name, carrier, total amount, and can click to view details

### AC-14: Admin Confirms Order

**Given** admin is viewing a submitted session detail
**When** they click Confirm (optionally after editing items/shipping fee)
**Then** the system creates a real `orders` record with type=ONLINE, status=PENDING, reserves stock for each item, logs audit, and updates session status to `confirmed`

### AC-15: Admin Rejects Order

**Given** admin is viewing a submitted session detail
**When** they click Reject with a reason
**Then** the session status is set to `rejected`, no order is created, no stock is reserved

### AC-16: Duplicate Submission Prevention

**Given** a customer has already submitted their order (session status = `submitted`)
**When** they try to access the same link again
**Then** they see the previously submitted summary with a message "Order already submitted"

### AC-17: Stock Visibility

**Given** a product has `currentStock - reservedStock <= 0`
**When** the customer views the catalog
**Then** the product shows as "Out of stock" and cannot be added to cart

### AC-18: Expired Session Cleanup

**Given** sessions with status `pending` that have passed their `expires_at`
**When** a scheduled check runs (or on access)
**Then** those sessions are marked as `expired`

---

## 8. Task Breakdown

### Phase 1: Backend - Data Layer

| # | Task | Depends On | Effort |
|---|------|------------|--------|
| B1 | Create migration `008_customer_order_sessions.sql` | None | S |
| B2 | Create `CustomerOrderSession` entity | B1 | S |
| B3 | Create `CustomerOrdersModule` with service | B2 | M |

### Phase 2: Backend - Public API

| # | Task | Depends On | Effort |
|---|------|------------|--------|
| B4 | Create `PublicOrderController` (no auth guard) with GET /:token and POST /:token/submit | B3 | M |
| B5 | Implement order summary text formatter service | B3 | M |
| B6 | Implement product catalog query (active+approved, with stock availability) | B4 | S |
| B7 | Add Zod/class-validator validation for submission DTO | B4 | S |

### Phase 3: Backend - Facebook Integration

| # | Task | Depends On | Effort |
|---|------|------------|--------|
| B8 | Create `FacebookMessengerService` (Send API wrapper) | None | M |
| B9 | Integrate messenger send into submission flow | B4, B8 | S |
| B10 | Add env vars: FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID | B8 | S |

### Phase 4: Backend - Admin API

| # | Task | Depends On | Effort |
|---|------|------------|--------|
| B11 | Create `CustomerOrdersController` (authenticated, admin endpoints) | B3 | M |
| B12 | Implement session confirm flow (creates real order via existing OrdersService) | B11 | M |
| B13 | Implement session reject flow | B11 | S |
| B14 | Add audit logging for customer order confirm/reject | B12, B13 | S |

### Phase 5: Frontend - Public Order Form

| # | Task | Depends On | Effort |
|---|------|------------|--------|
| F1 | Update middleware.ts to exclude /order/* from auth | None | S |
| F2 | Create publicApi.ts (axios without auth) | None | S |
| F3 | Create /order/[token] route + layout (no sidebar) | F1 | S |
| F4 | Build ProductCatalog + ProductCard components | F3 | M |
| F5 | Build CartSummary component (floating cart) | F4 | M |
| F6 | Build DeliveryForm with carrier-specific fields | F3 | M |
| F7 | Build OrderReviewStep (summary preview) | F5, F6 | M |
| F8 | Build OrderSubmittedPage + OrderExpiredPage | F7 | S |
| F9 | Wire up publicApi calls and form submission | F2, F7 | M |

### Phase 6: Frontend - Admin Management

| # | Task | Depends On | Effort |
|---|------|------------|--------|
| F10 | Replace online-orders placeholder with CustomerOrdersQueue | B11 | M |
| F11 | Build GenerateLinkDialog component | F10 | S |
| F12 | Build CustomerOrderDetail with edit capability | F10 | L |
| F13 | Build ConfirmOrderDialog + RejectDialog | F12 | M |
| F14 | Add customerOrdersApi to api.ts | None | S |

**Effort legend:** S = < 4h, M = 4-8h, L = 8-16h

### Recommended implementation order:

1. B1 -> B2 -> B3 (data layer)
2. B5 (summary formatter, can be tested independently)
3. B4 + B6 + B7 (public API)
4. F1 + F2 + F3 (frontend scaffolding)
5. F4 + F5 + F6 + F7 + F8 + F9 (customer form)
6. B8 + B9 + B10 (Facebook integration)
7. B11 + B12 + B13 + B14 (admin API)
8. F10 + F11 + F12 + F13 + F14 (admin UI)

---

## 9. Risks & Open Questions

### Open Questions (Require Product Decision)

| # | Question | Options | Impact |
|---|----------|---------|--------|
| OQ-1 | **Should the customer form support Thai + Chinese?** The customers are Thai but the store is in Taiwan. Some product names have `nameZh`. | A) Thai only B) Thai + toggle for Chinese product names | Frontend complexity |
| OQ-2 | **How does admin get the customer's PSID?** Facebook Messenger PSIDs are not visible in normal chat. Admin would need to use Meta Business Suite API or a webhook. | A) Admin manually enters PSID from Meta Business Suite B) Build a webhook to capture PSID when customer messages the page C) Skip PSID for v1 -- admin copies summary text manually | Determines if Facebook auto-send works in v1 |
| OQ-3 | **Should shipping fee be editable by customer or admin only?** Currently the summary includes shipping fee. | A) System auto-calculates from carrier rates, customer sees it, admin can override B) Customer does not see fee, admin fills it during confirm C) Customer sees estimated fee, admin confirms/overrides | UX + business logic |
| OQ-4 | **What happens when customer submits but admin never confirms?** Orders could sit in "submitted" forever. | A) Auto-expire after X hours B) Admin gets notification/reminder C) Nothing -- admin manually manages | Operational flow |
| OQ-5 | **Should the order link be single-use or reusable?** Can the customer re-open the same link to submit a different order? | A) Single-use (one submission per token) B) Reusable until expired (customer can submit multiple times) | Schema + flow design |
| OQ-6 | **Date format in summary: should it include year?** Examples show `20/06/69` (Buddhist era). Is this always DD/MM/YY (2-digit year)? | A) DD/MM/YY Buddhist era (as shown) B) DD/MM/YYYY Buddhist era | Summary formatter |
| OQ-7 | **For single-quantity items, should the format be `{name} {price}` or `{name} 1*{price}={price}`?** Examples show single items without the `qty*price=total` pattern. | A) Omit qty notation when qty=1 (match current behavior) B) Always show qty notation | Summary formatter |
| OQ-8 | **When payment is "transfer" (not COD), should the summary include bank account info?** | A) Yes, append bank details B) No, admin sends separately C) Configurable in settings | Summary format |
| OQ-9 | **Should the product catalog show ALL products or only a curated "online order" subset?** Some POS products (e.g., quick items) may not be relevant for online orders. | A) All active+approved products B) Add an `available_online` flag to products C) Admin selects products per session | Product filtering |

### Technical Risks

| # | Risk | Mitigation |
|---|------|------------|
| TR-1 | **Facebook Page Access Token expiry.** Page tokens can expire or be invalidated. | Use a long-lived Page Access Token. Add health check endpoint. Log failures prominently. |
| TR-2 | **Facebook 24-hour messaging window.** If customer takes too long to fill the form, the window may close before submission. | Graceful degradation: save order even if Messenger send fails. Show summary on-screen. |
| TR-3 | **Public endpoint abuse.** The `/public/order-sessions/:token/submit` endpoint has no auth. | Rate limiting per IP (e.g., 5 requests/minute). Token validation. Input sanitization. Consider CAPTCHA if abuse occurs. |
| TR-4 | **Session token brute-force.** Tokens in URLs could be guessed. | Use UUID v4 (122 bits of entropy). Add rate limiting on token lookups. |
| TR-5 | **No new npm dependency declared.** Facebook Graph API calls can be done with the already-installed `axios`. No new dependency needed. | Use axios directly for Facebook API calls. |
| TR-6 | **Middleware change affects all public routes.** Updating `middleware.ts` to exclude `/order/*` must not break existing auth flow. | Test thoroughly. Use specific path matching, not broad wildcards. |
| TR-7 | **Stock visibility lag.** Customer sees "in stock" but by the time admin confirms, stock may be gone. | Stock is not reserved at submission time. Admin confirmation checks available stock and fails fast if insufficient. Clear error message to admin. |

### Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Facebook Page Access Token | NOT YET CONFIGURED | Admin must set up in Meta Business Suite. Requires `pages_messaging` permission. |
| Facebook Page ID | NOT YET CONFIGURED | Available from Page settings. |
| Products data in POS | READY | Products module is fully functional with stock tracking. |
| Orders module | READY | `createOnlineOrder()` exists and handles stock reservation + audit. |
| Carriers config | READY | Both backend and frontend have carrier data. Only 3 of 6 carriers needed. |

---

## Appendix A: New Backend Module Structure

```
backend/src/modules/customer-orders/
  customer-order.entity.ts           -- CustomerOrderSession entity
  customer-orders.module.ts          -- Module registration
  customer-orders.service.ts         -- Business logic
  customer-orders.controller.ts      -- Admin endpoints (authenticated)
  public-order.controller.ts         -- Customer endpoints (public)
  order-summary-formatter.service.ts -- Text summary generation
  facebook-messenger.service.ts      -- Facebook Send API wrapper
  dto/
    create-session.dto.ts
    submit-order.dto.ts
    confirm-session.dto.ts
```

## Appendix B: New Frontend Structure

```
frontend/src/
  app/
    order/
      [token]/
        page.tsx                     -- Main customer order form
        layout.tsx                   -- Minimal public layout
    (main)/
      online-orders/
        page.tsx                     -- Enhanced admin queue (replace placeholder)
  components/
    customer-order/
      ProductCatalog.tsx
      ProductCard.tsx
      CartSummary.tsx
      DeliveryForm.tsx
      CarrierSelector.tsx
      SevenElevenFields.tsx
      FamilyMartFields.tsx
      BlackCatFields.tsx
      OrderReviewStep.tsx
      OrderSubmittedPage.tsx
      OrderExpiredPage.tsx
    admin/
      CustomerOrdersQueue.tsx
      CustomerOrderDetail.tsx
      GenerateLinkDialog.tsx
      OrderSummaryPreview.tsx
      ConfirmOrderDialog.tsx
  lib/
    publicApi.ts                     -- Axios instance without auth
```
