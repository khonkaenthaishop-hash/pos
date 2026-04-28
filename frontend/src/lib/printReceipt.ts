/**
 * Client-side print helper
 * Build ESC/POS bytes in browser → send to RawBT (localhost:8080)
 * RawBT app on Android forwards to printer via TCP/IP
 */

import type { ReceiptData } from './escpos/receiptBuilder';
import { buildImageReceiptPayload, shouldUseImageMode } from './escpos/imageReceipt';

export type { ReceiptData };

export type PrinterConfig = {
  host: string;
  port?: number;
};

// ─── ESC/POS byte helpers (browser-safe, no Node Buffer) ───────
const ESC = 0x1b;
const GS  = 0x1d;

function bytes(...args: number[]): Uint8Array {
  return new Uint8Array(args);
}

const THAI_WIN874: number[] = [
  // U+0E00..U+0E0F
  0x00, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7,
  0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF,
  // U+0E10..U+0E1F
  0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7,
  0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF,
  // U+0E20..U+0E2F
  0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7,
  0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF,
  // U+0E30..U+0E3F
  0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7,
  0xD8, 0xD9, 0xDA, 0x00, 0x00, 0x00, 0x00, 0xDF,
  // U+0E40..U+0E4F
  0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7,
  0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF,
  // U+0E50..U+0E5F
  0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7,
  0xF8, 0xF9, 0xFA, 0xFB, 0x00, 0x00, 0x00, 0x00,
];

function encodeAscii(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp >= 0x0e00 && cp <= 0x0e5f) {
      // Unicode Thai → Windows-874 byte
      const idx = cp - 0x0e00;
      out.push(THAI_WIN874[idx] ?? 0x3f);
    } else if (cp === 0x0a) out.push(0x0a);
    else out.push(0x3f); // '?'
  }
  return new Uint8Array(out);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}


function buildQr(content: string, size = 6): Uint8Array {
  const data    = new TextEncoder().encode(content);
  const dataLen = data.length + 3;
  const pL = dataLen & 0xff;
  const pH = (dataLen >> 8) & 0xff;
  return concat(
    bytes(0x1b, 0x61, 0x01),
    bytes(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00),
    bytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size),
    bytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31),
    bytes(0x1d, 0x28, 0x6b, pL,   pH,   0x31, 0x50, 0x30),
    data,
    bytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30),
    bytes(0x1b, 0x61, 0x00),
    bytes(0x0a),
  );
}

// ─── Build full ESC/POS payload in browser ─────────────────────
async function buildEscPos(receipt: ReceiptData): Promise<Uint8Array> {
  const { buildReceipt: formatText } =
    (await import('./escpos/receiptFormatter')) as {
      buildReceipt: (d: ReceiptData) => string;
    };
  const text = formatText(receipt);
  const codePage = typeof receipt.codePage === 'number' ? receipt.codePage : 70;

  const lines  = text.split('\n');
  const sepIdx = lines.findIndex((l, i) => i > 0 && l.startsWith('---') && i > lines.length / 2);
  const beforeQr = lines.slice(0, sepIdx + 1).join('\n');
  const afterQr  = lines.slice(sepIdx + 1).join('\n');

  const parts: Uint8Array[] = [
    bytes(ESC, 0x40),           // init
    bytes(0x1c, 0x2e),          // disable Chinese mode
    bytes(ESC, 0x74, codePage), // codepage via ESC t n
    bytes(ESC, 0x61, 0x00),     // align left
    encodeAscii(beforeQr),
    bytes(0x0a),
  ];

  if (receipt.promptPayQr) {
    parts.push(buildQr(receipt.promptPayQr, receipt.qrSize ?? 6));
  }

  parts.push(
    encodeAscii(afterQr),
    bytes(0x0a, 0x0a, 0x0a),
    bytes(GS, 0x56, 0x41, 0x0a), // partial cut
  );

  if (receipt.openDrawer) {
    parts.push(bytes(ESC, 0x70, 0x00, 0x19, 0xfa));
  }

  return concat(...parts);
}

// ─── Send to RawBT on Android (localhost:8080) ─────────────────
export async function printReceipt(
  receipt: ReceiptData,
  printer?: PrinterConfig,
): Promise<void> {
  const preferImage =
    (receipt as unknown as { renderMode?: unknown }).renderMode === 'image' ||
    ((receipt as unknown as { renderMode?: unknown }).renderMode !== 'text' &&
      shouldUseImageMode(receipt));

  const payload = preferImage
    ? buildImageReceiptPayload(receipt, {
        paperWidthMm: (receipt as unknown as { paperWidthMm?: number }).paperWidthMm as
          | 55
          | 72
          | undefined,
        codePage: receipt.codePage,
      })
    : await buildEscPos(receipt);

  // Always send via RawBT on localhost — Vercel cannot reach LAN printers
  void printer; // printer config kept for future use (e.g. local proxy)
  const payloadCopy = new Uint8Array(payload);
  const body = new Blob([payloadCopy.buffer], { type: 'application/octet-stream' });

  const res = await fetch('http://localhost:8080/rawbt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
  });

  if (!res.ok) {
    throw new Error(`RawBT error: ${res.status}`);
  }
}
