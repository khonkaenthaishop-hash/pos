# CONTEXT.md — Glossary (คำศัพท์ canonical ของโปรเจกต์)

> ไฟล์นี้เป็น Glossary ล้วนๆ — ห้ามมี implementation detail
> ถ้าใครใช้คำขัดกับนี้ AI ต้องทักท้วงทันที

| คำ (Canonical) | นิยาม | ห้ามสับสนกับ |
|---|---|---|
| **Order** | บิลขายออนไลน์ที่ลูกค้าสั่งมา | POS Sale (การขายหน้าร้าน) |
| **POS Sale** | การขายหน้าร้านผ่านหน้า POS | Order (ออนไลน์) |
| **Customer** | ลูกค้าที่สั่งของออนไลน์ มีชื่อ/เบอร์/ที่อยู่ | User (คนที่ login เข้าระบบ) |
| **User** | พนักงานที่ login เข้าใช้ระบบ (5 roles) | Customer |
| **Role** | สิทธิ์การใช้งานของ User: owner / manager / cashier / staff / admin | Permission (สิทธิ์ระดับ action) |
| **Stock** | จำนวนสินค้าในคลัง ณ ปัจจุบัน | Inventory (กระบวนการจัดการคลัง) |
| **Inventory** | กระบวนการ/module จัดการ stock เช่น รับของ, ปรับยอด | Stock (ตัวเลข) |
| **Carrier** | บริษัทขนส่ง (7-Eleven, Family Mart, OK Mart, Hi-Life, BlackCat, Thai Post) | Shipment (การส่งของ 1 ครั้ง) |
| **Shipment** | การส่งของ 1 ครั้ง ผูกกับ Order + Carrier | Carrier (บริษัทขนส่ง) |
| **Audit Log** | บันทึกอัตโนมัติของ action สำคัญ (STOCK_ADJUST, PRICE_CHANGE ฯลฯ) | System Log (log ของ NestJS/server) |
| **Location** | สาขา/ที่เก็บสินค้า รองรับ multi-location | Store (ร้านค้า) |
| **Migration** | SQL file ที่เปลี่ยน schema DB (`backend/database/migrations/`) | TypeORM sync (ห้ามใช้) |
| **COD** | Cash on Delivery — เก็บเงินปลายทาง | Prepaid (จ่ายล่วงหน้า) |
| **NT$** | New Taiwan Dollar — สกุลเงินที่ใช้ในระบบ | THB (บาทไทย — ไม่ใช้ในระบบ) |

## Audit Actions (canonical)

| Action | ความหมาย | ใครทำได้ |
|--------|----------|---------|
| `STOCK_ADJUST` | ปรับยอดคลังสินค้า | staff, manager, owner |
| `PRICE_CHANGE` | แก้ไขราคาสินค้า | owner เท่านั้น |
| `ORDER_CANCEL` | ยกเลิกบิล | manager, owner |
| `PRODUCT_APPROVE` | อนุมัติสินค้าใหม่ | manager, owner |
| `WRONG_ITEM_PACKED` | ของตกสลับ (ค่าปรับ 250 NT$) | manager, owner |

## Roles & Permissions (สรุป)

| Role | สิทธิ์หลัก |
|------|-----------|
| `owner` | ทุกอย่าง รวม price change |
| `manager` | จัดการ order + report + approve product |
| `cashier` | หน้าขาย POS เท่านั้น |
| `staff` | รับสินค้า + จัดการ stock |
| `admin` | จัดการ online order |
