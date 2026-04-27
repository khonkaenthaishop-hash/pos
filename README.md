# ร้านขอนแก่น POS System

ระบบ POS สำหรับร้านขอนแก่น ไต้หวัน — Thai Grocery Store in Taiwan

## Tech Stack

| Technology            | Purpose                      |
| --------------------- | ---------------------------- |
| Next.js 16.2          | App Router, React 19         |
| TypeScript 5          | Strict mode                  |
| Tailwind CSS v4       | Styling                      |
| shadcn/ui + Radix UI  | UI components                |
| Redux Toolkit         | State management             |
| React Hook Form + Zod | Form validation              |
| NextAuth v5           | Keycloak OIDC authentication |
| ECharts               | Charts and reports           |
| pnpm                  | Package manager              |

---

## ติดตั้งและ Start (First Time Setup)

### ข้อกำหนดเบื้องต้น

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (รันอยู่)
- Git
- ใช้คำสั่ง `docker compose` (Compose V2) เป็นหลัก

### 1. Clone โปรเจกต์

```bash
git clone <repo-url>
cd khonkaen-pos
```

### 2. Start ครั้งแรก (รีเซ็ต DB + seed ข้อมูล)

```bash
# ลบ volume เก่า (ถ้ามี) แล้ว build + start ทุก service
docker compose down -v
docker compose up -d --build
```

> รอประมาณ **30-60 วินาที** ให้ NestJS compile และ PostgreSQL พร้อม

### 3. ตรวจสอบว่าขึ้นครบ

```bash
docker compose ps
```

ควรเห็น 4 containers ที่ status `Up`:

```
NAME                STATUS
khonkaen_backend    Up
khonkaen_db         Up
khonkaen_frontend   Up
khonkaen_redis      Up
```

### 4. เปิดระบบ

| Service             | URL                                                         |
| ------------------- | ----------------------------------------------------------- |
| Frontend (หน้าร้าน) | http://localhost:3000                                       |
| Backend API Docs    | http://localhost:3001/api/docs                              |
| PostgreSQL          | localhost:**5433** (host port — 5432 ใช้โดย local postgres) |
| Redis               | localhost:6379                                              |

##List Open Files เพื่อหา Process ID (PID) ที่ใช้งานพอร์ต
lsof -i

##Kill Port (ปิดการใช้งาน)
kill -9 <PID>

(ปิด Port 3000): lsof -i :3000 -t | xargs kill -9

## Start/Stop ปกติ (ไม่ต้องรีเซ็ต DB)

```bash
# Start
docker compose up -d

# Stop (เก็บข้อมูลไว้)
docker compose stop

# Stop + ลบ container (เก็บ volume/data ไว้)
docker compose down

# Stop + ลบทุกอย่างรวม data (เริ่มใหม่ทั้งหมด)
docker compose down -v
```

## Kill port (macOS/Linux)

ถ้าพอร์ตค้าง/ชนกัน (เช่น `EADDRINUSE`) ให้เช็คและ kill process ที่จับพอร์ต:

```bash
./scripts/kill-port.sh 3000
./scripts/kill-port.sh 3001
```

## คำสั่งสร้าง migration ใหม่ รัน Migration

````bash

docker compose down -v
docker compose up -d
docker compose exec -T postgres psql -U khonkaen_user -d khonkaen_pos < backend/database/migrations/004_multi_location.sql

docker compose restart


---

## ดู Logs

```bash

# เริ่ม Service ที่หยุดอยู่
docker compose start

# รีสตาร์ตทุก Service
docker compose restart

# เริ่มและดู Log ไปด้วยพร้อมกัน (foreground)
docker compose up

# หยุดทุก Service
docker compose down

# ดู log ทุก service (กด Ctrl+C เพื่อออก)
docker compose logs -f

# ดูเฉพาะ backend
docker compose logs -f backend

# ดูเฉพาะ frontend
docker compose logs -f frontend

# ดูเฉพาะ database
docker compose logs -f postgres

# ดู 50 บรรทัดล่าสุด
docker logs khonkaen_backend --tail=50

# ตรวจสอบ error เฉพาะ
docker logs khonkaen_backend 2>&1 | grep -i error
docker logs khonkaen_frontend 2>&1 | grep -E "error|Error|⨯"
````

### Log ที่บอกว่าระบบพร้อม

**Backend ready:**

```
Nest application successfully started
Server running on http://localhost:3001
Swagger docs: http://localhost:3001/api/docs
```

**Frontend ready:**

```
Ready in XXXX ms
```

---

## ทดสอบ Login

```bash
# ทดสอบ API login (ควรได้ access_token กลับมา)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"cashier","password":"admin1234"}'
```

---

## หมายเหตุ Docker (Frontend → Backend)

- ใน `docker-compose.yml` ตั้ง `NEXT_PUBLIC_API_URL` เป็น `http://localhost:3001` เพราะโค้ด frontend ถูกเรียกจาก **browser บนเครื่อง host** (ไม่ใช่จากใน container) จึงต้องชี้มาที่ port ที่ map ออกมาของ backend

## Database Schema Update (กรณี DB เก่า)

ถ้าเจอ error แนวนี้ใน backend logs:

```
column p.min_wholesale_qty does not exist
```

แปลว่า volume DB เก่าไม่มี field ใหม่ในตาราง `products` (TypeORM ตั้ง `synchronize: false` และ schema ถูกจัดการด้วย SQL)

รัน migration นี้กับ DB ใน container:

```
docker compose exec -T postgres psql -U khonkaen_user -d khonkaen_pos < backend/database/migrations/001_inventory_fields.sql
```

หมายเหตุ: ถ้าต้องการเริ่ม DB ใหม่ทั้งหมด (ลบข้อมูล) ใช้ `docker compose down -v` แล้ว `docker compose up -d` อีกครั้ง

## Default Users (Development)

| Username | Password  | Role        | สิทธิ์                 |
| -------- | --------- | ----------- | ---------------------- |
| owner    | admin1234 | เจ้าของร้าน | ทุกอย่าง               |
| manager  | admin1234 | ผู้จัดการ   | จัดการออเดอร์ + รายงาน |
| cashier  | admin1234 | แคชเชียร์   | หน้าขาย POS            |
| staff    | admin1234 | พนักงาน     | รับสินค้า + คลัง       |
| admin    | admin1234 | แอดมิน      | ออนไลน์ออเดอร์         |

---

## Project Structure

```
khonkaen-pos/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── modules/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── products/
│   │       ├── categories/
│   │       ├── orders/
│   │       ├── customers/
│   │       ├── shipments/
│   │       ├── carriers/
│   │       ├── audit/
│   │       └── reports/
│   ├── database/
│   │   └── init.sql          ← schema + seed data
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/login/
    │   │   └── (main)/
    │   │       ├── dashboard/
    │   │       ├── pos/
    │   │       ├── online-orders/
    │   │       ├── products/
    │   │       ├── stock/
    │   │       └── audit/
    │   ├── lib/
    │   │   └── api.ts         ← axios client + API functions
    │   ├── store/
    │   │   └── auth.store.ts  ← zustand auth state
    │   ├── constants/
    │   │   └── carriers.ts
    │   └── i18n/
    │       ├── th.json
    │       ├── zh_TW.json
    │       └── en.json
    ├── package.json
    └── tsconfig.json          ← paths: "@/*" → "./src/*"
```

---

## Carrier Summary

| ขนส่ง       | ธรรมดา      | เย็น        | COD     | ระยะเวลา |
| ----------- | ----------- | ----------- | ------- | -------- |
| 7-Eleven    | 70 NT$      | 150 NT$     | ≤20,000 | 3-5 วัน  |
| Family Mart | 80 NT$      | 150 NT$     | ≤5,000  | 3-5 วัน  |
| OK Mart     | 70 NT$      | 150 NT$     | ≤5,000  | 3-5 วัน  |
| Hi-Life     | 70 NT$      | ❌          | ❌      | -        |
| แมวดำ       | 130-250 NT$ | 160-350 NT$ | ✅      | 1 วัน    |
| ไปรษณีย์    | 100-200 NT$ | ❌          | +30 NT$ | -        |

---

## Audit Actions (บันทึกอัตโนมัติ)

- `STOCK_ADJUST` — ปรับยอดคลัง
- `PRICE_CHANGE` — แก้ไขราคา (เจ้าของเท่านั้น)
- `ORDER_CANCEL` — ยกเลิกบิล
- `PRODUCT_APPROVE` — อนุมัติสินค้าใหม่
- `WRONG_ITEM_PACKED` — ของตกสลับ (ค่าปรับ 250 NT$)

---

## Multi-Language

รองรับ 3 ภาษา: ไทย 🇹🇭 | 繁體中文 🇹🇼 | English 🇬🇧

---

## Bugs ที่แก้แล้ว

| ปัญหา                | สาเหตุ                                              | วิธีแก้                               |
| -------------------- | --------------------------------------------------- | ------------------------------------- |
| Login ไม่ได้         | password hash เป็น placeholder                      | แทนด้วย bcrypt hash จริงใน `init.sql` |
| Backend crash        | `StockModule` import ที่ไม่มีอยู่                   | ลบออกจาก `app.module.ts`              |
| Frontend 500         | `@/lib/api` path alias หาย                          | เพิ่ม `paths` ใน `tsconfig.json`      |
| TypeScript error     | ใช้ string literal แทน `AuditAction` enum           | import enum ใน `products.service.ts`  |
| DB sync error        | TypeORM `synchronize: true` conflict กับ `init.sql` | ตั้งเป็น `false`                      |
| `date-fns` not found | ไม่ได้ติดตั้งใน backend                             | แทนด้วย native JS                     |

---

**Day 1** ✅ Project Setup + Database Schema + Constants
**Day 2** ✅ Auth + POS + Online Orders (แก้ bugs ทั้งหมด)
**Day 3** 🔄 Dashboard + Reports + Deploy
