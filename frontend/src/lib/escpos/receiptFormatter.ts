/**
 * Receipt Formatter — 58mm Thermal Printer (32 chars/line)
 * Xprinter / ESC/POS compatible
 *
 * Rules:
 * - Every line MUST be exactly WIDTH (32) characters
 * - Thai-safe: use [...str].length for codepoint counting
 * - Space-based alignment only
 * - No external dependencies
 */

export const WIDTH = 32;

// Column widths — must sum to WIDTH exactly
// name(15) + qty(5) + price(12) = 32
// NOTE: show only Name/Qty/Price (no per-item total column)
const COL_NAME = 15;
const COL_QTY = 5;
const COL_PRICE = 12;
const COL_VALUE = COL_PRICE;


// ─── Unicode-safe primitives ───────────────────────────────────

/** นับความยาว string เป็น Unicode codepoints (Thai-safe) */
function uLen(s: string): number {
  return [...s].length;
}

/** ตัด string ที่ n codepoints */
/** Thai combining marks / zero-width marks that should not affect column width */
function isZeroWidthMark(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  // Thai marks: MAI HAN-AKAT, SARA I.., MAITAIKHU.., etc.
  if (cp === 0x0e31) return true;
  if (cp >= 0x0e34 && cp <= 0x0e3a) return true;
  if (cp >= 0x0e47 && cp <= 0x0e4e) return true;
  return false;
}

/** ความกว้างเพื่อจัดคอลัมน์ (นับเฉพาะตัวที่กินช่อง) */
function uWidth(s: string): number {
  let w = 0;
  for (const ch of [...s]) {
    if (isZeroWidthMark(ch)) continue;
    w += 1;
  }
  return w;
}

/**
 * ตัดข้อความตามความกว้างคอลัมน์ (Thai-safe)
 * - นับความกว้างโดยไม่นับ combining marks
 * - ถ้าตัดกลางตัวอักษร + วรรณยุกต์ จะดึง marks ที่ตามมามาด้วย
 */
function truncateByWidth(text: string, maxWidth: number): string {
  const chars = [...text];
  const out: string[] = [];
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const chW = isZeroWidthMark(ch) ? 0 : 1;
    if (w + chW > maxWidth) break;
    out.push(ch);
    w += chW;
  }
  // include trailing combining marks right after last base char
  let j = out.length;
  while (j < chars.length && isZeroWidthMark(chars[j]!)) {
    out.push(chars[j]!);
    j++;
  }
  return out.join('');
}

// ─── Layout helpers ────────────────────────────────────────────

/** จัดชิดซ้าย — ผล: string ที่มีความยาว = width เสมอ */
export function padRight(text: string, width: number): string {
  const len = uWidth(text);
  if (len >= width) return truncateByWidth(text, width);
  return text + ' '.repeat(width - len);
}

/** จัดชิดขวา — ผล: string ที่มีความยาว = width เสมอ */
export function padLeft(text: string, width: number): string {
  const len = uWidth(text);
  if (len >= width) {
    // take the right-most part by width
    const chars = [...text];
    let w = 0;
    let start = chars.length;
    for (let i = chars.length - 1; i >= 0; i--) {
      const ch = chars[i]!;
      const chW = isZeroWidthMark(ch) ? 0 : 1;
      if (w + chW > width) break;
      start = i;
      w += chW;
    }
    return chars.slice(start).join('');
  }
  return ' '.repeat(width - len) + text;
}

/** จัดกึ่งกลาง — ผล: string ที่มีความยาว = width เสมอ */
export function center(text: string, width: number): string {
  const len = uWidth(text);
  if (len >= width) return truncateByWidth(text, width);
  const pad   = width - len;
  const left  = Math.floor(pad / 2);
  const right = pad - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

/** เส้นคั่น — ผล: string ความยาว = width เสมอ */
export function separator(char = '-', width = WIDTH): string {
  return char.repeat(width);
}

/**
 * ตัด string เป็น lines ที่ <= maxWidth codepoints
 * - English: word-wrap ที่ space ถ้าอยู่หลังครึ่งบรรทัด
 * - Thai: hard-cut (ไม่มี space ระหว่างคำ)
 * ผล: array มีอย่างน้อย 1 element เสมอ
 */
export function wrapText(text: string, maxWidth: number): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let start = 0;

  while (start < chars.length) {
    const end = start + maxWidth;

    // บรรทัดสุดท้าย
    if (end >= chars.length) {
      lines.push(chars.slice(start).join(''));
      break;
    }

    // หา space ตัวสุดท้ายในช่วง [start, end)
    let cutAt = maxWidth;
    for (let i = maxWidth - 1; i > maxWidth / 2; i--) {
      if (chars[start + i] === ' ') {
        cutAt = i;
        break;
      }
    }

    lines.push(chars.slice(start, start + cutAt).join(''));

    // ข้าม space ที่ตัด
    start += cutAt;
    if (chars[start] === ' ') start++;
  }

  return lines.length > 0 ? lines : [''];
}

// ─── Debug utility ─────────────────────────────────────────────

/**
 * แสดง receipt พร้อม line length เพื่อ debug alignment
 * บรรทัดที่ยาวเกิน WIDTH จะมี ❌ นำหน้า
 *
 * @example
 * console.log(debugReceipt(buildReceipt(data)));
 */
export function debugReceipt(receipt: string): string {
  return receipt
    .split('\n')
    .map((line, i) => {
      const len = uLen(line);
      const flag = len > WIDTH ? '❌' : '  ';
      const no   = String(i + 1).padStart(3, ' ');
      return `${flag} ${no} [${String(len).padStart(2, ' ')}] |${line}|`;
    })
    .join('\n');
}

/** Assert ทุกบรรทัด <= WIDTH — throw ถ้าเจอบรรทัดยาวเกิน (ใช้ใน tests) */
export function assertWidth(receipt: string): void {
  receipt.split('\n').forEach((line, i) => {
    const len = uLen(line);
    if (len > WIDTH) {
      throw new Error(
        `Line ${i + 1} exceeds ${WIDTH} chars (got ${len}): "${line}"`,
      );
    }
  });
}

// ─── Receipt types ─────────────────────────────────────────────

export type ReceiptItem = {
  name: string;
  qty: number;
  price: number;
};

export type ReceiptData = {
  // If headerLines is provided, it will be used (centered line-by-line).
  // Otherwise, fallback to shopName/address/tel.
  headerLines?: string[];
  shopName?: string;
  address?: string;
  tel?: string;
  receiptNo?: string;
  issuedAt?: Date;
  cashierName?: string;
  items: ReceiptItem[];
  // Summary / totals
  subtotal?: number; // default: computed from items
  discount?: number; // default: 0
  vatRate?: number; // default: 0 (e.g. 0.07)
  vat?: number; // default: computed from (subtotal - discount) * vatRate
  total: number; // net total
  paymentMethodLabel?: string;
  cash?: number;
  change?: number;
  footerLines?: string[];
};

// ─── Formatters ────────────────────────────────────────────────

function money(n: number): string {
  return n.toFixed(2);
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildHeader(data: ReceiptData): string[] {
  const lines: string[] = [];
  const headerLines = (data.headerLines ?? []).map((l) => String(l ?? '').trim()).filter(Boolean);
  if (headerLines.length > 0) {
    lines.push(...headerLines.map((l) => center(l, WIDTH)));
  } else {
    lines.push(center(data.shopName || 'RECEIPT', WIDTH));
    if (data.address) lines.push(center(data.address, WIDTH));
    if (data.tel) lines.push(center(`Tel: ${data.tel}`, WIDTH));
  }

  if (data.receiptNo) lines.push(center(`#${data.receiptNo}`, WIDTH));
  if (data.issuedAt) lines.push(center(formatDate(data.issuedAt), WIDTH));
  if (data.cashierName) lines.push(center(`Cashier: ${data.cashierName}`, WIDTH));
  return lines;
}

function buildTableHeader(): string {
  // ผลรวม: COL_NAME + COL_QTY + COL_PRICE = WIDTH
  return (
    padRight('Name',  COL_NAME)  +
    padLeft('Qty',    COL_QTY)   +
    padLeft('Price',  COL_PRICE)
  );
}

function buildItemLines(item: ReceiptItem): string[] {
  const name = truncateByWidth(String(item.name ?? ''), COL_NAME);
  return [
    padRight(name, COL_NAME) +
      padLeft(String(item.qty), COL_QTY) +
      padLeft(money(item.price), COL_PRICE),
  ];
}

function buildSummary(data: ReceiptData): string[] {
  const LABEL_W = WIDTH - COL_VALUE;
  const row = (label: string, value: string): string =>
    padRight(label, LABEL_W) + padLeft(value, COL_VALUE);

  const subtotal = typeof data.subtotal === 'number'
    ? data.subtotal
    : data.items.reduce((s, i) => s + i.qty * i.price, 0);
  const discount = typeof data.discount === 'number' ? data.discount : 0;
  const baseForVat = Math.max(0, subtotal - discount);
  const vatRate = typeof data.vatRate === 'number' ? data.vatRate : 0;
  const vat = typeof data.vat === 'number' ? data.vat : Number((baseForVat * vatRate).toFixed(2));

  const lines: string[] = [separator('=')];
  lines.push(row('SUBTOTAL', money(subtotal)));
  lines.push(row('DISCOUNT', money(discount)));
  lines.push(row(`VAT ${(vatRate * 100).toFixed(0)}%`, money(vat)));
  lines.push(separator('-'));
  lines.push(row('TOTAL', money(data.total)));
  if (data.paymentMethodLabel) {
    lines.push(padRight(`PAYMENT: ${data.paymentMethodLabel}`, WIDTH));
  }
  if (typeof data.cash === 'number') lines.push(row('CASH', money(data.cash)));
  if (typeof data.change === 'number') lines.push(row('CHANGE', money(data.change)));
  return lines;
}

function buildFooter(footerLines?: string[]): string[] {
  const lines = footerLines ?? ['Thank you for your purchase'];
  return lines.map(l => center(l, WIDTH));
}

// ─── Main export ───────────────────────────────────────────────

/**
 * สร้าง receipt string — ทุกบรรทัดยาว <= 48 characters
 *
 * @example
 * const text = buildReceipt({ shopName: 'KHONKAEN', items, total: 44 });
 */
export function buildReceipt(data: ReceiptData): string {
  const lines: string[] = [];

  lines.push(...buildHeader(data));
  lines.push(separator('='));
  lines.push(buildTableHeader());
  lines.push(separator('-'));

  for (const item of data.items) {
    lines.push(...buildItemLines(item));
  }

  lines.push(...buildSummary(data));
  lines.push(separator('-'));
  lines.push(...buildFooter(data.footerLines));
  lines.push(separator('-'));
  lines.push('');

  return lines.join('\n');
}
