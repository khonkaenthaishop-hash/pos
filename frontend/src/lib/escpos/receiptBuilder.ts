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
  setCodePage:    (n: number) => Buffer.from([ESC, 0x74, n & 0xff]), // ESC t n
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

// ─── Thai Win874 encoder ───────────────────────────────────────
// Map Unicode Thai (U+0E00–U+0E5F) to Windows-874 bytes.
// Other non-ASCII chars become '?' to avoid dropping content silently.
const THAI_WIN874 = Buffer.from([
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
]);

function encodeThaiWin874(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp >= 0x0e00 && cp <= 0x0e5f) bytes.push(THAI_WIN874[cp - 0x0e00] || 0x3f);
    else bytes.push(0x3f);
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
  /** ESC/POS codepage number for `ESC t n` (e.g. 26 is commonly Thai/CP874 on many printers) */
  codePage?: number;
  /** Used by image-mode renderer to pick dot width */
  paperWidthMm?: 55 | 72;
  /** Force rendering mode for printing */
  renderMode?: "auto" | "text" | "image";
};

// ─── Main export ───────────────────────────────────────────────
export function buildReceipt(data: ReceiptData): Buffer {
  const text = formatReceipt(data);
  const codePage = typeof data.codePage === "number" ? data.codePage : 70;

  const lines  = text.split("\n");
  const sepIdx = lines.findIndex(
    (l, i) => i > 0 && l.startsWith("---") && i > lines.length / 2,
  );
  const beforeQr = lines.slice(0, sepIdx + 1).join("\n");
  const afterQr  = lines.slice(sepIdx + 1).join("\n");

  const parts: Buffer[] = [
    Cmd.init(),
    Cmd.disableChinese(),
    Cmd.setCodePage(codePage),
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
