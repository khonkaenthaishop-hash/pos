/**
 * ESC/POS Receipt Builder
 * ReceiptData -> format text -> encode ESC/POS -> return Buffer
 *
 * Separation of concerns:
 *   receiptFormatter.ts  — text layout (Thai-safe, 48 chars/line)
 *   receiptBuilder.ts    — ESC/POS encoding + Buffer assembly
 */

import {
  buildReceipt as formatReceipt,
  type ReceiptData as FormatterData,
} from "./receiptFormatter";

// ─── ESC/POS byte constants ────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

export const Cmd = {
  init:           () => Buffer.from([ESC, 0x40]),
  disableChinese: () => Buffer.from([0x1c, 0x2e]),      // FS . — disable Chinese mode
  setEnglish:     () => Buffer.from([ESC, 0x74, 0x00]), // ESC t 0 — PC437
  alignLeft:      () => Buffer.from([ESC, 0x61, 0x00]),
  alignCenter:    () => Buffer.from([ESC, 0x61, 0x01]),
  alignRight:     () => Buffer.from([ESC, 0x61, 0x02]),
  boldOn:         () => Buffer.from([ESC, 0x45, 0x01]),
  boldOff:        () => Buffer.from([ESC, 0x45, 0x00]),
  newline:        () => Buffer.from([LF]),
  cutPartial:     () => Buffer.from([GS, 0x56, 0x41, 0x0a]),
  cutFull:        () => Buffer.from([GS, 0x56, 0x00]),
  cashDrawer:     () => Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]),
  text:           (str: string) => encodeThaiWin874(str),
};

// ─── ASCII-only encoder (printer uses PC437 / no Thai font) ───
// Thai characters are stripped — only ASCII 0x20-0x7E is kept.
function encodeThaiWin874(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp >= 0x20 && cp <= 0x7e) {
      bytes.push(cp);          // printable ASCII — keep as-is
    } else if (cp === 0x0a) {
      bytes.push(0x0a);        // newline
    }
    // Thai (0x0E00-0x0E7F) and other non-ASCII → skip silently
  }
  return Buffer.from(bytes);
}

// ─── QR Code (GS ( k) ─────────────────────────────────────────
function buildQrBuffer(content: string, size = 6): Buffer {
  const data    = Buffer.from(content, "utf8");
  const dataLen = data.length + 3;
  const pL = dataLen & 0xff;
  const pH = (dataLen >> 8) & 0xff;

  return Buffer.concat([
    Buffer.from([0x1b, 0x61, 0x01]),                               // center
    Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // model 2
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]),        // size
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),        // error level M
    Buffer.from([0x1d, 0x28, 0x6b, pL,   pH,   0x31, 0x50, 0x30]),        // store data
    data,
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),        // print
    Buffer.from([0x1b, 0x61, 0x00]),                               // left
    Buffer.from([0x0a]),
  ]);
}

// ─── Public types ──────────────────────────────────────────────
export type ReceiptData = FormatterData & {
  openDrawer?: boolean;
  promptPayQr?: string;
  qrSize?: number;
};

// ─── Main export ───────────────────────────────────────────────
export function buildReceipt(data: ReceiptData): Buffer {
  const text = formatReceipt(data);

  const lines  = text.split("\n");
  const sepIdx = lines.findIndex(
    (l, i) => i > 0 && l.startsWith("---") && i > lines.length / 2,
  );
  const beforeQr = lines.slice(0, sepIdx + 1).join("\n");
  const afterQr  = lines.slice(sepIdx + 1).join("\n");

  const parts: Buffer[] = [
    Cmd.init(),
    Cmd.disableChinese(),
    Cmd.setEnglish(),
    Cmd.alignLeft(),
    encodeThaiWin874(beforeQr),
    Cmd.newline(),
  ];

  if (data.promptPayQr) {
    parts.push(buildQrBuffer(data.promptPayQr, data.qrSize ?? 6));
  }

  parts.push(
    encodeThaiWin874(afterQr),
    Cmd.newline(),
    Cmd.newline(),
    Cmd.newline(),
    Cmd.cutPartial(),
  );

  if (data.openDrawer) parts.push(Cmd.cashDrawer());

  return Buffer.concat(parts);
}

export const buildReceiptBuffer = buildReceipt;
