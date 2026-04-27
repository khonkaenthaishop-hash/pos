/**
 * Unit tests — receiptFormatter.ts
 * ทดสอบ layout functions, Thai-safe width, wrapText, buildReceipt
 */

import {
  WIDTH,
  padRight, padLeft, center, separator, wrapText,
  buildReceipt, assertWidth, debugReceipt,
} from '@/lib/escpos/receiptFormatter';
import { makeReceiptData, makeItems, LONG_THAI_NAME, LONG_ENG_NAME, EXACT_24_NAME } from '../helpers/testData';

// ─── padRight ─────────────────────────────────────────────────

describe('padRight', () => {
  it('pads ASCII string to exact width', () => {
    const r = padRight('abc', 10);
    expect([...r].length).toBe(10);
    expect(r).toBe('abc       ');
  });

  it('truncates ASCII string exceeding width', () => {
    const r = padRight('abcdefghij', 5);
    expect(r).toBe('abcde');
    expect([...r].length).toBe(5);
  });

  it('pads Thai string using codepoint length', () => {
    const r = padRight('สวัสดี', 10); // 6 Thai codepoints
    expect([...r].length).toBe(10);
    expect(r.startsWith('สวัสดี')).toBe(true);
  });

  it('truncates Thai string at exact codepoints', () => {
    const r = padRight('กขคงจฉชซ', 4); // keep first 4
    expect([...r].length).toBe(4);
    expect(r).toBe('กขคง');
  });

  it('handles empty string', () => {
    const r = padRight('', 5);
    expect(r).toBe('     ');
    expect([...r].length).toBe(5);
  });
});

// ─── padLeft ──────────────────────────────────────────────────

describe('padLeft', () => {
  it('right-aligns ASCII string', () => {
    const r = padLeft('99.00', 10);
    expect([...r].length).toBe(10);
    expect(r).toBe('     99.00');
  });

  it('truncates string exceeding width', () => {
    const r = padLeft('1234567890', 5);
    expect([...r].length).toBe(5);
  });

  it('right-aligns Thai string by codepoints', () => {
    const r = padLeft('ราคา', 8);
    expect([...r].length).toBe(8);
    expect(r.endsWith('ราคา')).toBe(true);
  });
});

// ─── center ───────────────────────────────────────────────────

describe('center', () => {
  it('centers even-length text', () => {
    const r = center('abcd', 10);
    expect([...r].length).toBe(10);
    expect(r).toBe('   abcd   ');
  });

  it('centers odd-length text (extra space on right)', () => {
    const r = center('abc', 10);
    expect([...r].length).toBe(10);
    const left  = r.indexOf('abc');
    const right = 10 - left - 3;
    expect(right).toBeGreaterThanOrEqual(left);
  });

  it('centers Thai text by codepoints', () => {
    const r = center('สวัสดี', WIDTH); // 6 codepoints in 48
    expect([...r].length).toBe(WIDTH);
  });

  it('truncates text longer than width', () => {
    const long = 'x'.repeat(60);
    const r = center(long, WIDTH);
    expect([...r].length).toBe(WIDTH);
  });
});

// ─── separator ────────────────────────────────────────────────

describe('separator', () => {
  it('produces exactly WIDTH dashes by default', () => {
    expect(separator().length).toBe(WIDTH);
    expect(separator()).toBe('-'.repeat(WIDTH));
  });

  it('produces exactly WIDTH of custom char', () => {
    expect(separator('=').length).toBe(WIDTH);
    expect(separator('=', 10).length).toBe(10);
  });
});

// ─── wrapText ────────────────────────────────────────────────

describe('wrapText', () => {
  it('returns single-element array for short text', () => {
    const lines = wrapText('สวัสดี', 24);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('สวัสดี');
  });

  it('hard-cuts Thai text at maxWidth codepoints', () => {
    const text   = 'กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ'; // 44 chars
    const lines  = wrapText(text, 10);
    lines.forEach(l => {
      expect([...l].length).toBeLessThanOrEqual(10);
    });
    // reassemble should cover original text
    expect(lines.join('')).toBe(text);
  });

  it('word-wraps English text at space', () => {
    const text  = 'Hello World Foo Bar Baz Extra';
    const lines = wrapText(text, 12);
    lines.forEach(l => {
      expect([...l].length).toBeLessThanOrEqual(12);
    });
  });

  it('returns at least one element for empty string', () => {
    const lines = wrapText('', 10);
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it('handles text exactly at maxWidth', () => {
    const text  = 'a'.repeat(24);
    const lines = wrapText(text, 24);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(text);
  });

  it('handles LONG_THAI_NAME > 24 codepoints', () => {
    const lines = wrapText(LONG_THAI_NAME, 24);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach(l => expect([...l].length).toBeLessThanOrEqual(24));
  });
});

// ─── buildReceipt — width constraint ─────────────────────────

describe('buildReceipt — every line <= 48 chars', () => {
  it('basic receipt passes assertWidth', () => {
    const text = buildReceipt(makeReceiptData());
    expect(() => assertWidth(text)).not.toThrow();
  });

  it('receipt with long Thai product name passes assertWidth', () => {
    const data = makeReceiptData({
      items: [{ name: LONG_THAI_NAME, qty: 1, price: 99 }],
      total: 99,
    });
    const text = buildReceipt(data);
    expect(() => assertWidth(text)).not.toThrow();
  });

  it('receipt with long English product name passes assertWidth', () => {
    const data = makeReceiptData({
      items: [{ name: LONG_ENG_NAME, qty: 3, price: 250 }],
      total: 750,
    });
    const text = buildReceipt(data);
    expect(() => assertWidth(text)).not.toThrow();
  });

  it('receipt with 50 items stays within width', () => {
    const data = makeReceiptData({ items: makeItems(50), total: 9999 });
    const text = buildReceipt(data);
    expect(() => assertWidth(text)).not.toThrow();
  });

  it('receipt with exact-24-char name passes assertWidth', () => {
    const data = makeReceiptData({
      items: [{ name: EXACT_24_NAME, qty: 1, price: 55 }],
      total: 55,
    });
    const text = buildReceipt(data);
    expect(() => assertWidth(text)).not.toThrow();
  });

  it('all separators are exactly WIDTH chars', () => {
    const text  = buildReceipt(makeReceiptData());
    const sepLines = text.split('\n').filter(l => /^[-=]+$/.test(l));
    expect(sepLines.length).toBeGreaterThan(0);
    sepLines.forEach(l => expect([...l].length).toBe(WIDTH));
  });
});

// ─── buildReceipt — content correctness ──────────────────────

describe('buildReceipt — content', () => {
  it('includes receiptNo', () => {
    const text = buildReceipt(makeReceiptData({ receiptNo: 'POS-2026-999' }));
    expect(text).toContain('POS-2026-999');
  });

  it('includes shop name', () => {
    const text = buildReceipt(makeReceiptData());
    expect(text).toContain('KHONKAEN TEST SHOP');
  });

  it('includes cashier name', () => {
    const text = buildReceipt(makeReceiptData({ cashierName: 'นายทดสอบ' }));
    expect(text).toContain('นายทดสอบ');
  });

  it('shows TOTAL value', () => {
    const text = buildReceipt(makeReceiptData({ total: 123.45 }));
    expect(text).toContain('123.45');
  });

  it('shows CASH when provided', () => {
    const text = buildReceipt(makeReceiptData({ cash: 200, change: 77 }));
    expect(text).toContain('200.00');
    expect(text).toContain('77.00');
  });

  it('omits CASH/CHANGE when not provided', () => {
    const text = buildReceipt(makeReceiptData({ cash: undefined, change: undefined }));
    expect(text).not.toContain('CASH');
    expect(text).not.toContain('CHANGE');
  });

  it('includes footer lines', () => {
    const text = buildReceipt(makeReceiptData({ footerLines: ['TEST FOOTER LINE'] }));
    expect(text).toContain('TEST FOOTER LINE');
  });

  it('includes all item names', () => {
    const items = makeItems(5);
    const text  = buildReceipt(makeReceiptData({ items, total: 999 }));
    items.forEach(item => {
      // ชื่อสินค้าอาจถูก wrap — ตรวจแค่ส่วนแรก 10 chars
      expect(text).toContain([...item.name].slice(0, 10).join(''));
    });
  });
});

// ─── debugReceipt ─────────────────────────────────────────────

describe('debugReceipt', () => {
  it('marks lines exceeding WIDTH with ❌', () => {
    const badReceipt = 'x'.repeat(50) + '\n' + 'ok';
    const debug = debugReceipt(badReceipt);
    expect(debug).toContain('❌');
  });

  it('marks valid lines with spaces (no ❌)', () => {
    const text  = buildReceipt(makeReceiptData());
    const debug = debugReceipt(text);
    expect(debug).not.toContain('❌');
  });

  it('shows line numbers', () => {
    const text  = 'line one\nline two';
    const debug = debugReceipt(text);
    expect(debug).toContain('  1');
    expect(debug).toContain('  2');
  });
});
