/**
 * Cash Drawer via Web Serial API (ESC/POS)
 * รองรับ Chrome / Edge เท่านั้น
 * เครื่องพิมพ์ต้องต่อกับลิ้นชักผ่านช่อง RJ11/RJ12 บนตัวเครื่องพิมพ์
 */

import { writeBytes, resetSharedPort } from './serialPort';

// ESC p m t1 t2 — เปิดลิ้นชักพอร์ต 0
const CASH_DRAWER_COMMAND = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

/**
 * เปิดลิ้นชักเงินสด
 * ครั้งแรก: popup ให้ user เลือก serial port ของเครื่องพิมพ์
 * ครั้งต่อไป: ใช้ port เดิม (จนกว่าจะ reload หน้า)
 */
export async function openCashDrawer(): Promise<boolean> {
  try {
    await writeBytes(CASH_DRAWER_COMMAND);
    return true;
  } catch (err) {
    if ((err as DOMException).name !== 'NotFoundError') {
      resetSharedPort();
    }
    console.error('openCashDrawer error:', err);
    return false;
  }
}

/** เคลียร์ port ที่จำไว้ (ใช้เมื่อต้องการเลือก port ใหม่) */
export function resetCashDrawerPort(): void {
  resetSharedPort();
}
