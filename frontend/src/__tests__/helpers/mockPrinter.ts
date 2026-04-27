/**
 * Mock TCP Printer Server
 * รัน net.Server จริงบน localhost เพื่อทดสอบ TCP connection
 * - success mode: รับ data แล้ว close
 * - offline mode: ไม่ฟัง (ECONNREFUSED)
 * - timeout mode: รับ connection แต่ไม่ตอบ ทำให้ client timeout
 */

import net from 'net';

export type MockPrinterMode = 'success' | 'timeout' | 'error-on-write';

export class MockPrinterServer {
  private server: net.Server | null = null;
  private openSockets: Set<net.Socket> = new Set();
  public receivedBuffers: Buffer[] = [];
  public connectionCount = 0;

  /** เปิด mock server บน localhost:port */
  async start(port: number, mode: MockPrinterMode = 'success'): Promise<void> {
    this.receivedBuffers = [];
    this.connectionCount = 0;
    this.openSockets = new Set();

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.connectionCount++;
        this.openSockets.add(socket);
        socket.on('close', () => this.openSockets.delete(socket));

        if (mode === 'timeout') {
          // รับ connection แต่ไม่ทำอะไร — ทำให้ client timeout
          return;
        }

        if (mode === 'error-on-write') {
          socket.destroy(new Error('simulated write error'));
          return;
        }

        // success — เก็บ data แล้ว close
        const chunks: Buffer[] = [];
        socket.on('data', (chunk) => chunks.push(chunk));
        socket.on('end', () => {
          this.receivedBuffers.push(Buffer.concat(chunks));
          socket.end();
        });
      });

      this.server.listen(port, '127.0.0.1', () => resolve());
      this.server.on('error', reject);
    });
  }

  /** ปิด mock server (force-destroy open sockets so close() doesn't hang) */
  async stop(): Promise<void> {
    for (const s of this.openSockets) s.destroy();
    this.openSockets.clear();
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  /** bytes ทั้งหมดที่รับมา (concat ทุก connection) */
  get totalReceived(): Buffer {
    return Buffer.concat(this.receivedBuffers);
  }
}

/**
 * Port allocator — uses a random base offset per process + sequential counter
 * to avoid collisions when Jest runs test files in separate worker processes.
 */
const BASE_PORT = 19000 + Math.floor(Math.random() * 500) * 2;
let nextPort = BASE_PORT;
export function allocatePort(): number {
  return nextPort++;
}
