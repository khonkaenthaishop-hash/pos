/**
 * Unit tests — receiptBuilder.ts
 * ทดสอบ ESC/POS Buffer output: init, codepage, cut, cash drawer, QR
 */

import { buildReceipt, buildReceiptBuffer, Cmd } from '@/lib/escpos/receiptBuilder';
import { makeReceiptData } from '../helpers/testData';

// ESC/POS command signatures
const ESC = 0x1b;
const GS  = 0x1d;

function bufferContains(haystack: Buffer, needle: number[]): boolean {
  const n = Buffer.from(needle);
  for (let i = 0; i <= haystack.length - n.length; i++) {
    if (haystack.slice(i, i + n.length).equals(n)) return true;
  }
  return false;
}

// ─── Buffer structure ─────────────────────────────────────────

describe('buildReceipt — Buffer structure', () => {
  let buf: Buffer;

  beforeEach(() => {
    buf = buildReceipt(makeReceiptData());
  });

  it('returns a Buffer', () => {
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('starts with ESC @ (init)', () => {
    expect(buf[0]).toBe(ESC);
    expect(buf[1]).toBe(0x40);
  });

  it('contains ESC t 0x15 (Windows-874 codepage)', () => {
    expect(bufferContains(buf, [ESC, 0x74, 0x15])).toBe(true);
  });

  it('contains GS V A 0x0A (partial cut)', () => {
    expect(bufferContains(buf, [GS, 0x56, 0x41, 0x0a])).toBe(true);
  });

  it('does NOT contain cash drawer command when openDrawer=false', () => {
    const b = buildReceipt(makeReceiptData({ openDrawer: false }));
    expect(bufferContains(b, [ESC, 0x70, 0x00, 0x19, 0xfa])).toBe(false);
  });

  it('contains cash drawer command AFTER cut when openDrawer=true', () => {
    const b = buildReceipt(makeReceiptData({ openDrawer: true }));
    expect(bufferContains(b, [ESC, 0x70, 0x00, 0x19, 0xfa])).toBe(true);

    // drawer command must appear after cut command
    const cutIdx    = b.indexOf(Buffer.from([GS, 0x56, 0x41, 0x0a]));
    const drawerIdx = b.indexOf(Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]));
    expect(drawerIdx).toBeGreaterThan(cutIdx);
  });

  it('buildReceiptBuffer is an alias for buildReceipt', () => {
    const data = makeReceiptData();
    expect(buildReceiptBuffer(data)).toEqual(buildReceipt(data));
  });
});

// ─── Thai encoding ────────────────────────────────────────────

describe('Thai Windows-874 encoding', () => {
  it('encodes Thai codepoints as single bytes in Windows-874 range', () => {
    const data = makeReceiptData({
      items: [{ name: 'กข', qty: 1, price: 10 }],
      total: 10,
    });
    const buf = buildReceipt(data);

    // ก = U+0E01 → Windows-874 = 0xA1
    // ข = U+0E02 → Windows-874 = 0xA2
    expect(bufferContains(buf, [0xa1, 0xa2])).toBe(true);
  });

  it('encodes ASCII as-is', () => {
    const data = makeReceiptData({ shopName: 'ABC' });
    const buf  = buildReceipt(data);
    expect(bufferContains(buf, [0x41, 0x42, 0x43])).toBe(true); // A B C
  });

  it('replaces unknown characters with 0x3F (?)', () => {
    // Chinese character — not in Thai or ASCII range
    const data = makeReceiptData({ shopName: '中文' });
    const buf  = buildReceipt(data);
    expect(bufferContains(buf, [0x3f, 0x3f])).toBe(true);
  });
});

// ─── QR code ─────────────────────────────────────────────────

describe('QR code (promptPayQr)', () => {
  const QR_PAYLOAD = '00020101021229370016A000000677010111';

  it('contains GS ( k sequence when promptPayQr is set', () => {
    const buf = buildReceipt(makeReceiptData({ promptPayQr: QR_PAYLOAD }));
    // GS ( k store data: 1D 28 6B
    expect(bufferContains(buf, [0x1d, 0x28, 0x6b])).toBe(true);
  });

  it('does NOT contain GS ( k when promptPayQr is absent', () => {
    const buf = buildReceipt(makeReceiptData({ promptPayQr: undefined }));
    expect(bufferContains(buf, [0x1d, 0x28, 0x6b])).toBe(false);
  });

  it('QR appears before cut command', () => {
    const buf    = buildReceipt(makeReceiptData({ promptPayQr: QR_PAYLOAD }));
    const qrIdx  = buf.indexOf(Buffer.from([0x1d, 0x28, 0x6b]));
    const cutIdx = buf.indexOf(Buffer.from([GS, 0x56, 0x41, 0x0a]));
    expect(qrIdx).toBeLessThan(cutIdx);
  });

  it('encodes QR payload as UTF-8 bytes inside buffer', () => {
    const buf     = buildReceipt(makeReceiptData({ promptPayQr: QR_PAYLOAD }));
    const payload = Buffer.from(QR_PAYLOAD, 'utf8');
    expect(bufferContains(buf, [...payload])).toBe(true);
  });
});

// ─── Cmd helpers ─────────────────────────────────────────────

describe('Cmd helpers', () => {
  it('Cmd.init returns [ESC, 0x40]', () => {
    expect([...Cmd.init()]).toEqual([ESC, 0x40]);
  });

  it('Cmd.cashDrawer returns ESC p 0 25 250', () => {
    expect([...Cmd.cashDrawer()]).toEqual([ESC, 0x70, 0x00, 0x19, 0xfa]);
  });

  it('Cmd.cutPartial returns GS V A 10', () => {
    expect([...Cmd.cutPartial()]).toEqual([GS, 0x56, 0x41, 0x0a]);
  });

  it('Cmd.text encodes Thai correctly', () => {
    const b = Cmd.text('ก'); // U+0E01 → 0xA1
    expect(b[0]).toBe(0xa1);
  });
});
