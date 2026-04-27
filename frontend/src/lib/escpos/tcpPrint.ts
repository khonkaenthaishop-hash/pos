/**
 * TCP Printer Client
 * ส่ง ESC/POS bytes ไปเครื่องพิมพ์ผ่าน TCP (รัน server-side เท่านั้น)
 * Xprinter XP-80T default port: 9100
 */

import net from 'net';

export type TcpPrinterConfig = {
  host: string;
  port?: number;      // default 9100
  timeout?: number;   // ms, default 5000
};

/**
 * ส่ง Buffer ไปยัง TCP printer
 * - connect → write → wait for drain → destroy
 * - throw error ถ้า timeout หรือ printer offline
 */
export function sendToTcpPrinter(
  data: Buffer,
  config: TcpPrinterConfig,
): Promise<void> {
  const { host, port = 9100, timeout = 5000 } = config;

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.write(data, (err) => {
        if (err) return finish(err);
        // drain แล้ว close
        socket.end();
      });
    });

    socket.on('end', () => finish());
    socket.on('close', () => finish());

    socket.on('timeout', () =>
      finish(new Error(`Printer timeout — ${host}:${port} ไม่ตอบสนองใน ${timeout}ms`))
    );

    socket.on('error', (err) => {
      const msg =
        (err as NodeJS.ErrnoException).code === 'ECONNREFUSED'
          ? `เครื่องพิมพ์ออฟไลน์ — ไม่สามารถเชื่อมต่อ ${host}:${port}`
          : err.message;
      finish(new Error(msg));
    });

    socket.connect(port, host);
  });
}
