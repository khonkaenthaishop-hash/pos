/**
 * Client-side print helper
 * Build ESC/POS bytes in browser → send to RawBT (localhost:8080)
 * RawBT app on Android forwards to printer via TCP/IP
 */

import type { ReceiptData } from './escpos/receiptBuilder';

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

function encodeAscii(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x20 && cp <= 0x7e) out.push(cp);
    else if (cp === 0x0a) out.push(0x0a);
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

  const lines  = text.split('\n');
  const sepIdx = lines.findIndex((l, i) => i > 0 && l.startsWith('---') && i > lines.length / 2);
  const beforeQr = lines.slice(0, sepIdx + 1).join('\n');
  const afterQr  = lines.slice(sepIdx + 1).join('\n');

  const parts: Uint8Array[] = [
    bytes(ESC, 0x40),           // init
    bytes(0x1c, 0x2e),          // disable Chinese mode
    bytes(ESC, 0x74, 0x00),     // PC437
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
  if (printer?.host) {
    const res = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt, printer }),
    });

    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const errorMessage =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error?: unknown }).error)
          : `Print API error: ${res.status}`;
      throw new Error(errorMessage);
    }

    if (!(typeof json === 'object' && json !== null && (json as { success?: unknown }).success === true)) {
      const errorMessage =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error?: unknown }).error)
          : 'Print failed';
      throw new Error(errorMessage);
    }

    return;
  }

  const payload = await buildEscPos(receipt);
  // Normalize to an ArrayBuffer-backed view (avoids SharedArrayBuffer typing issues)
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
