# ADR-0001: ใช้ npm แทน pnpm

- **สถานะ:** Accepted
- **วันที่:** 2026-06-21
- **ผู้ตัดสินใจ:** ทีม + AI Agent

## บริบท (Context)

โปรเจกต์เริ่มต้นใช้ pnpm เป็น package manager (pnpm@10, Node.js 22)
เมื่อ deploy frontend ขึ้น Vercel พบ error:

```
ERR_INVALID_THIS
```

ลองแก้หลายรูปแบบ: pin pnpm@10, ใช้ corepack, lock Node.js 22 — ยังไม่ work
Vercel build pipeline มีปัญหา compatibility กับ pnpm version ที่ใช้

## ทางเลือกที่พิจารณา (Options)

1. **pnpm@10 + corepack** — ข้อดี: workspace support ดี, fast / ข้อเสีย: Vercel build พัง
2. **pnpm@8 (downgrade)** — ข้อดี: อาจ compatible กว่า / ข้อเสีย: เวอร์ชันเก่า, ไม่ทดสอบ
3. **npm** — ข้อดี: Vercel native support, ไม่มี compatibility issue / ข้อเสีย: ช้ากว่า pnpm เล็กน้อย

## การตัดสินใจ (Decision)

เลือก **npm** เพราะ Vercel รองรับ npm โดย default โดยไม่ต้องกำหนดค่าพิเศษ และปัญหาหายทันทีหลัง switch

## ผลที่ตามมา (Consequences)

- ✅ Vercel build ผ่าน
- ✅ ไม่ต้องกำหนดค่า corepack หรือ engine ใน vercel.json
- ⚠️ `package.json` ยังมี `"packageManager": "pnpm@10.11.0"` — ต้องแก้ให้ตรง
- ⚠️ lock file เป็น `package-lock.json` แทน `pnpm-lock.yaml`
- สิ่งที่ต้องทำต่อ: อัปเดต `package.json` field `packageManager` ให้ตรงกับ npm

## ทบทวนเมื่อ (Revisit when)

- Vercel แก้ปัญหา compatibility กับ pnpm เวอร์ชันใหม่
- โปรเจกต์ต้องการ workspace feature ที่ npm ทำไม่ได้
