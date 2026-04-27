/**
 * Shared Web Serial port singleton
 * ทั้ง cash drawer และ ESC/POS printer ใช้ port เดียวกัน
 * รองรับ Chrome / Edge เท่านั้น
 */

let cachedPort: SerialPort | null = null;

async function getPort(): Promise<SerialPort> {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial API ไม่รองรับ browser นี้ — ใช้ Chrome หรือ Edge');
  }
  if (!cachedPort) {
    cachedPort = await navigator.serial.requestPort();
  }
  if (!cachedPort.readable) {
    await cachedPort.open({ baudRate: 9600 });
  }
  return cachedPort;
}

/**
 * ส่ง bytes ไปยัง serial port
 * จัดการ writer lock ให้อัตโนมัติ ปลอดภัยสำหรับการเรียกต่อเนื่อง
 */
export async function writeBytes(data: Uint8Array): Promise<void> {
  const port = await getPort();

  if (!port.writable) throw new Error('Serial port ไม่พร้อม');

  // ถ้า stream ยัง locked อยู่ รอให้ unlock ก่อน
  if (port.writable.locked) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!port.writable?.locked) {
          clearInterval(check);
          resolve();
        }
      }, 10);
    });
  }

  const writer = port.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}

export function resetSharedPort(): void {
  cachedPort = null;
}
