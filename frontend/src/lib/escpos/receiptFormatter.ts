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
// name(16) + qty(4) + price(6) + total(6) = 32
const COL_NAME  = 16;
const COL_QTY   =  4;
const COL_PRICE =  6;
const COL_TOTAL =  6;


// ─── Unicode-safe primitives ───────────────────────────────────

/** นับความยาว string เป็น Unicode codepoints (Thai-safe) */
function uLen(s: string): number {
  return [...s].length;
}

/** ตัด string ที่ n codepoints */
function uSlice(s: string, start: number, end?: number): string {
  return [...s].slice(start, end).join('');
}

// ─── Layout helpers ────────────────────────────────────────────

/** จัดชิดซ้าย — ผล: string ที่มีความยาว = width เสมอ */
export function padRight(text: string, width: number): string {
  const len = uLen(text);
  if (len >= width) return uSlice(text, 0, width);
  return text + ' '.repeat(width - len);
}

/** จัดชิดขวา — ผล: string ที่มีความยาว = width เสมอ */
export function padLeft(text: string, width: number): string {
  const len = uLen(text);
  if (len >= width) return uSlice(text, 0, width);
  return ' '.repeat(width - len) + text;
}

/** จัดกึ่งกลาง — ผล: string ที่มีความยาว = width เสมอ */
export function center(text: string, width: number): string {
  const len = uLen(text);
  if (len >= width) return uSlice(text, 0, width);
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
  shopName: string;
  address?: string;
  tel?: string;
  receiptNo?: string;
  issuedAt?: Date;
  cashierName?: string;
  items: ReceiptItem[];
  total: number;
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
  lines.push(center(data.shopName, WIDTH));
  if (data.address)     lines.push(center(data.address, WIDTH));
  if (data.tel)         lines.push(center(`Tel: ${data.tel}`, WIDTH));
  if (data.receiptNo)   lines.push(center(`#${data.receiptNo}`, WIDTH));
  if (data.issuedAt)    lines.push(center(formatDate(data.issuedAt), WIDTH));
  if (data.cashierName) lines.push(center(`Cashier: ${data.cashierName}`, WIDTH));
  return lines;
}

function buildTableHeader(): string {
  // ผลรวม: COL_NAME + COL_QTY + COL_PRICE + COL_TOTAL = 48
  return (
    padRight('Name',  COL_NAME)  +
    padLeft('Qty',    COL_QTY)   +
    padLeft('Price',  COL_PRICE) +
    padLeft('Total',  COL_TOTAL)
  );
}

function buildItemLines(item: ReceiptItem): string[] {
  const lines: string[] = [];
  const itemTotal = item.qty * item.price;
  const nameLines = wrapText(item.name, COL_NAME);

  // บรรทัดแรก: name + qty + price + total (รวม = 48)
  lines.push(
    padRight(nameLines[0], COL_NAME)  +
    padLeft(String(item.qty),   COL_QTY)   +
    padLeft(money(item.price),  COL_PRICE) +
    padLeft(money(itemTotal),   COL_TOTAL),
  );

  // บรรทัด wrap: name column + padding ให้ครบ WIDTH
  for (let i = 1; i < nameLines.length; i++) {
    lines.push(
      padRight(nameLines[i], COL_NAME) +
      ' '.repeat(COL_QTY + COL_PRICE + COL_TOTAL),
    );
  }

  return lines;
}

function buildSummary(data: ReceiptData): string[] {
  const LABEL_W = WIDTH - COL_TOTAL;
  const row = (label: string, value: string): string =>
    padRight(label, LABEL_W) + padLeft(value, COL_TOTAL);

  const lines: string[] = [separator('=')];
  lines.push(row('TOTAL',  money(data.total)));
  if (typeof data.cash   === 'number') lines.push(row('CASH',   money(data.cash)));
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
