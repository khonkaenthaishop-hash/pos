<!-- ไฟล์นี้ประกอบจากมาตรฐานกลาง — แก้ส่วนกลางที่ repo มาตรฐาน -->
@.claude/CLAUDE.base.md

<!-- ════════════════════════════════════════════════════════════════
     PROJECT OVERRIDES — เติมเฉพาะของโปรเจกต์นี้
     ส่วนนี้ sync update จะ "ไม่แตะ" — เป็นพื้นที่ของคุณ
     ════════════════════════════════════════════════════════════════ -->

# โปรเจกต์: ร้านขอนแก่น POS System

> ระบบ POS + Online Orders สำหรับร้านขายของไทยในไต้หวัน
> ใช้โดยทีมงาน 5 roles: owner, manager, cashier, staff, admin

## Tech Stack (ที่อนุญาต)

- **Frontend:** Next.js 16.2 (App Router) + React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui + Radix UI, Redux Toolkit, Zustand, React Hook Form + Zod, ECharts, NextAuth v5
- **Backend:** NestJS 10, TypeScript 5, Passport JWT, Swagger
- **Database:** PostgreSQL — schema จัดการด้วย SQL migrations (`backend/database/migrations/`) ห้ามใช้ TypeORM sync
- **Runtime:** Docker Compose (dev), Vercel (frontend prod), Render (backend prod)
- **Package Manager:** npm (ทั้ง frontend และ backend)

## ข้อห้าม (Development Constraints — "ห้ามทำ")

- ห้ามเพิ่ม dependency ใหม่โดยไม่ถามก่อน
- ห้ามแก้ไฟล์ใน `backend/database/migrations/` ตรงๆ — ต้องสร้าง migration file ใหม่เสมอ
- ห้ามเปิด TypeORM `synchronize: true` — ใช้ SQL migrations เท่านั้น
- ห้ามใช้ pnpm — ใช้ npm เท่านั้น (Vercel compatibility)

## Golden Rules (ตรวจก่อน implement ทุกครั้ง)

> Full reference: `docs/context/golden-rules.md`

**Checklist:**
1. Requirement เข้าใจครบหรือยัง — ถ้ากำกวม หยุดถาม อย่าเดา
2. มีของเดิมใช้ได้ไหม — อย่า reinvent ถ้ามี service/util อยู่แล้ว
3. Permission ครบไหม — ทุก action ต้องตรวจ role (owner/manager/cashier/staff/admin)
4. Audit Log ต้องมีไหม — stock/price/order/user ต้อง log ทุกครั้ง
5. รองรับ Scale ไหม — ระวัง N+1, full table scan, missing index
6. Error Handling ครบไหม — Fail Fast: throw ทันที อย่า swallow exception
7. Loading/Empty State ครบไหม — ทุก list ต้องมี skeleton + empty state
8. กระทบ Module อื่นไหม — map dependency ก่อน (products → orders → inventory → audit)
9. มี Technical Debt ไหม — ถ้าเป็น shortcut ให้บันทึก TODO + เหตุผล
10. ถ้าฉันลาออกพรุ่งนี้ คนอื่นจะเข้าใจ Code นี้ไหม

**Enforce เสมอ:**
- **KISS** — ถ้ามีทางที่ง่ายกว่า ให้เลือกทางนั้น
- **YAGNI** — ห้ามเขียนโค้ดที่ไม่ได้ขอตอนนี้
- **SRP** — ทุก module/service มีความรับผิดชอบเดียว
- **Fail Fast** — throw exception ทันทีที่ input ผิด
- **Boy Scout Rule** — โค้ดที่แตะต้องสะอาดกว่าเดิมเสมอ

## คำสั่งสำคัญ

```bash
# dev (docker):
docker compose up -d

# reset DB:
docker compose down -v && docker compose up -d --build

# run migration:
docker compose exec -T postgres psql -U khonkaen_user -d khonkaen_pos < backend/database/migrations/<file>.sql

# logs:
docker compose logs -f backend
docker compose logs -f frontend

# kill port:
./scripts/kill-port.sh 3000
```

## บริบทเพิ่มเติม

- Glossary: `docs/context/CONTEXT.md`
- Tech constraints: `docs/context/tech-stack-constraints.md`
- Golden Rules (full): `docs/context/golden-rules.md`
- ADRs: `docs/adr/`
- Workflows: `personal-skills/workflows/`
- Checklists: `personal-skills/checklists/`
- Templates: `personal-skills/templates/`
