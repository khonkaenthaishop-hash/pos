/**
 * Printer Service — TCP Socket
 * Connect to ESC/POS thermal printer via IP:9100
 * - Timeout: 3s
 * - Retry: 2 retries
 * - Promise-based
 */

import net from 'net';
import { logger } from '../logger';

export type PrinterConfig = {
  host: string;
  port?: number;     // default 9100
  timeout?: number;  // ms, default 3000
  retries?: number;  // default 2
};

function attemptSend(buffer: Buffer, host: string, port: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.write(buffer, (err) => {
        if (err) return finish(err);
        socket.end();
      });
    });

    socket.on('end',   () => finish());
    socket.on('close', () => finish());

    socket.on('timeout', () =>
      finish(new Error(`Printer timeout — ${host}:${port} did not respond within ${timeout}ms`))
    );

    socket.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      const msg =
        code === 'ECONNREFUSED' ? `Printer offline — cannot connect to ${host}:${port}` :
        code === 'ETIMEDOUT'    ? `Printer timeout — ${host}:${port}` :
        err.message;
      finish(new Error(msg));
    });

    socket.connect(port, host);
  });
}

/**
 * ส่ง ESC/POS buffer ไปยัง printer ผ่าน TCP
 * retry อัตโนมัติ (default 2 ครั้ง) ถ้า connection ล้มเหลว
 */
export async function sendToPrinter(
  buffer: Buffer,
  config: PrinterConfig,
): Promise<void> {
  const { host, port = 9100, timeout = 3000, retries = 2 } = config;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await attemptSend(buffer, host, port, timeout);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        logger.warn('printer: retrying', { attempt: attempt + 1, of: retries, host, port, error: lastError.message });
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  throw lastError;
}
