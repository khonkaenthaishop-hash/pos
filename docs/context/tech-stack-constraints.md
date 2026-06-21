# Tech Stack & Constraints

## Stack ที่อนุญาต

- **Runtime:** Node.js 22+ (frontend), Node.js 20+ (backend)
- **Frontend:** Next.js 16.2 (App Router), React 19, TypeScript 5 strict mode
- **Backend:** NestJS 10, TypeScript 5, Passport JWT
- **Styling:** Tailwind CSS v4, shadcn/ui + Radix UI
- **State:** Redux Toolkit (global), Zustand (auth), React Hook Form + Zod (forms)
- **DB:** PostgreSQL — migrations ด้วย raw SQL เท่านั้น
- **Package Manager:** npm (ทั้ง frontend และ backend)
- **Dev Runtime:** Docker Compose
- **Prod:** Vercel (frontend), Render (backend)
- **Test:** ยังไม่มี — TODO

## ข้อห้าม (Hard "don'ts")

- [ ] ห้ามใช้ pnpm — Vercel build incompatibility (ดู ADR-0001)
- [ ] ห้ามเปิด TypeORM `synchronize: true` — ใช้ SQL migrations เท่านั้น
- [ ] ห้ามแก้ไฟล์ใน `backend/database/migrations/` ตรงๆ — ต้องสร้าง file ใหม่
- [ ] ห้ามเพิ่ม npm dependency ใหม่โดยไม่ถามก่อน
- [ ] ห้ามโหลด localization JSON (`i18n/*.json`) ทั้งไฟล์เข้า context — ใช้ query แทน
- [ ] ห้าม hardcode NT$ amount หรือ carrier fee — ดึงจาก `constants/carriers.ts`

## DB Conventions

- Schema เปลี่ยนได้เฉพาะผ่าน migration file ใหม่: `backend/database/migrations/NNN_<description>.sql`
- ไม่มี ORM auto-migration — TypeORM ใช้แค่ Entity mapping (query builder)
- Port DB ใน Docker: **5433** (host) → 5432 (container) เพื่อหลีกเลี่ยง conflict

## Frontend Conventions

- Path alias: `@/*` → `./src/*` (tsconfig.json)
- API calls ผ่าน `src/lib/api.ts` (axios client) เท่านั้น — ห้าม fetch ตรงจาก component
- i18n: 3 ภาษา (th, zh_TW, en) — ไฟล์อยู่ที่ `src/i18n/`

## CI/CD ที่ต้องผ่านก่อน merge

- [ ] lint (ESLint)
- [ ] build (`next build`)
- [ ] ไม่มี TypeScript error
- [ ] Docker Compose ขึ้นครบ 4 containers
