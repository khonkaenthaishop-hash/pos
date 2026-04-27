/**
 * ESC/POS Encoder
 * แปลง plain text (UTF-8) เป็น ESC/POS byte payload
 * รองรับภาษาไทยด้วย TIS-620 / Windows-874
 */

// ─── ESC/POS Commands ──────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

export const CMD = {
  INIT:          Buffer.from([ESC, 0x40]),           // ESC @ — reset printer
  // ค่า codepage ของ "Thai" แตกต่างตามรุ่นเครื่อง; หลายรุ่นรายงาน 255 ใน self-test
  CODEPAGE_THAI: Buffer.from([ESC, 0x74, 0xff]),     // ESC t 255 — Thai (ตามใบ self-test)
  ALIGN_LEFT:    Buffer.from([ESC, 0x61, 0x00]),     // ESC a 0
  ALIGN_CENTER:  Buffer.from([ESC, 0x61, 0x01]),     // ESC a 1
  BOLD_ON:       Buffer.from([ESC, 0x45, 0x01]),     // ESC E 1
  BOLD_OFF:      Buffer.from([ESC, 0x45, 0x00]),     // ESC E 0
  FEED_3:        Buffer.from([LF, LF, LF]),           // 3 line feeds before cut
  CUT_PARTIAL:   Buffer.from([GS, 0x56, 0x41, 0x0a]),// GS V A 10 — partial cut
  CASH_DRAWER:   Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]), // ESC p — open drawer
} as const;

/**
 * Unicode Thai (U+0E00–U+0E5F) → Windows-874 byte lookup table
 */
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

/** แปลง UTF-8 string → Windows-874 Buffer (รองรับ ASCII + Thai) */
export function encodeText(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp >= 0x0e00 && cp <= 0x0e5f) {
      bytes.push(THAI_WIN874[cp - 0x0e00] || 0x3f);
    } else {
      bytes.push(0x3f); // '?' สำหรับ character อื่นๆ
    }
  }
  return Buffer.from(bytes);
}

export type PrintJob = {
  text: string;       // plain text จาก buildReceiptText()
  openDrawer?: boolean;
};

/**
 * สร้าง ESC/POS payload พร้อมส่งให้ printer
 */
export function buildPayload(job: PrintJob): Buffer {
  const parts: Buffer[] = [
    CMD.INIT,
    CMD.CODEPAGE_THAI,
    CMD.ALIGN_LEFT,
  ];

  if (job.openDrawer) {
    parts.push(CMD.CASH_DRAWER);
  }

  parts.push(encodeText(job.text));
  parts.push(CMD.FEED_3);
  parts.push(CMD.CUT_PARTIAL);

  return Buffer.concat(parts);
}
