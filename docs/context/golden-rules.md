# Golden Rules & Software Engineering Principles

> Full reference doc — อ่านเพื่อบริบท, enforce จริงดูที่ CLAUDE.md

---

## Project Golden Rules (ตรวจก่อน implement ทุกครั้ง)

1. **Requirement เข้าใจครบหรือยัง** — ถ้ายังกำกวม ให้หยุดถาม อย่าเดาแล้วเขียน
2. **มีของเดิมใช้ได้ไหม** — DRY: อย่า reinvent ถ้ามี service/util อยู่แล้ว
3. **Permission ครบไหม** — ทุก endpoint/action ต้องตรวจ role ให้ครบ (5 roles: owner, manager, cashier, staff, admin)
4. **Audit Log ต้องมีไหม** — action ที่กระทบ stock/price/order/user ต้อง log ทุกครั้ง
5. **รองรับ Scale ไหม** — query ที่ load ทั้งตาราง, N+1 problem, missing index
6. **Error Handling ครบไหม** — Fail Fast: throw ทันที อย่า swallow exception
7. **Loading/Empty State ครบไหม** — UI ต้องมี skeleton/spinner และ empty state ทุก list
8. **กระทบ Module อื่นไหม** — map dependency ก่อน เช่น แก้ products กระทบ orders, inventory, audit
9. **มี Technical Debt ไหม** — ถ้าเป็น shortcut ให้บันทึก TODO + เหตุผลไว้
10. **ถ้าฉันลาออก พรุ่งนี้คนอื่นจะเข้าใจ Code นี้ไหม** — ชื่อตัวแปร, โครงสร้าง, comment ต้อง self-explanatory

---

## Core Philosophies

### The Goal of Software
ซอฟต์แวร์มีไว้ **ช่วยคน** ไม่ใช่โชว์ความฉลาด ทุก feature ให้ถามว่า "ช่วยใครได้อย่างไร?"

### Simplicity First
- **KISS**: Simple systems work better. ความซับซ้อน ≠ ความฉลาด
- **Occam's Razor**: ทางแก้ที่ง่ายที่สุดมักถูกต้องที่สุด
- วัดคุณภาพโค้ดจากการ **ลบโค้ดที่ไม่จำเป็นออก** ไม่ใช่จากจำนวนบรรทัดที่เพิ่ม

---

## SOLID Principles

| Principle | คำอธิบาย | เป้าหมาย |
|-----------|----------|----------|
| **S**ingle Responsibility | class/method มีหน้าที่เดียว | ป้องกัน God Object |
| **O**pen-Closed | เปิดให้ extend, ปิดไม่ให้แก้ | เพิ่ม feature โดยไม่พัง existing |
| **L**iskov Substitution | subclass แทน superclass ได้ | inheritance ไม่สร้าง side effect |
| **I**nterface Segregation | interface เฉพาะทาง ไม่ใช่ one-size-fits-all | ไม่บังคับ implement method ที่ไม่ใช้ |
| **D**ependency Inversion | depend on abstraction ไม่ใช่ concrete | ลด coupling |

---

## Operational Efficiency

- **DRY** (Don't Repeat Yourself): code ซ้ำ = maintenance cost ซ้ำ
- **YAGNI** (You Aren't Gonna Need It): อย่าเขียนโค้ดที่ "น่าจะต้องใช้" — ถ้าไม่ได้ขอ ไม่ต้องทำ
- **No Premature Optimization**: อย่า optimize ก่อนพิสูจน์ว่าช้าจริง (ต้องมีตัวเลข)
- **Automation**: สิ่งที่ทำซ้ำต้อง automate

### Prioritization Formula
```
Desirability ∝ Value / Effort
```
feature ที่ value สูง + effort ต่ำ = ทำก่อน

---

## Code Quality

- **Meaningful Names**: ชื่อ class/method/variable ต้องบอกว่าทำอะไร ไม่ต้องอ่าน body
- **Comments = Why, not What**: ถ้า comment อธิบาย "what" แสดงว่าโค้ดต้อง refactor
- **Boy Scout Rule**: โค้ดที่แตะต้องสะอาดกว่าเดิมเสมอ

---

## Testing & Reliability

- **TDD Golden Rule**: อย่าเขียน functionality ใหม่โดยไม่มี failing test ก่อน
- **Fail Fast**: throw exception ทันทีที่ input/state ผิด — อย่า swallow
- **Reproduce First**: ก่อนแก้ bug ต้อง reproduce ได้ก่อน อย่าแก้จากการเดา
- **Log Early**: ใส่ logging ตั้งแต่เริ่ม ไม่ใช่รอให้พังแล้วค่อยใส่

---

## Professional Mindset

- **Estimation**: ทุกอย่างใช้เวลานานกว่าที่คิด — แบ่งงานใหญ่เป็นงานย่อยเสมอ
- **Know When to Stop**: ถ้าทำมา 4 ชั่วโมงแล้วยังไม่ถึง 25% ของ 2 ชั่วโมงที่ estimate — หยุดและขอความช่วยเหลือ
- **Perfect is the Enemy of Good**: Start small → improve → extend อย่ารอให้สมบูรณ์แบบก่อนปล่อย

### Feynman Technique
ถ้าอธิบายปัญหาแบบง่ายๆ ไม่ได้ = ยังไม่เข้าใจปัญหาจริงๆ → แบ่งเป็นปัญหาย่อยก่อน
