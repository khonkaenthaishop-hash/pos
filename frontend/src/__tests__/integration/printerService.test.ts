/**
 * Integration tests — printerService.ts
 * ใช้ MockPrinterServer (net.Server จริง) บน localhost
 * ทดสอบ: success, offline, timeout, retry
 */

import { sendToPrinter } from '@/lib/escpos/printerService';
import { MockPrinterServer, allocatePort } from '../helpers/mockPrinter';

// mock logger เพื่อไม่ให้ output รกใน test
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const PAYLOAD = Buffer.from([0x1b, 0x40, 0x41, 0x42, 0x43]); // ESC @ A B C

describe('sendToPrinter — success', () => {
  const server = new MockPrinterServer();
  let port: number;

  beforeAll(async () => {
    port = allocatePort();
    await server.start(port, 'success');
  });

  afterAll(async () => { await server.stop(); });

  it('resolves without error', async () => {
    await expect(sendToPrinter(PAYLOAD, { host: '127.0.0.1', port, timeout: 1000, retries: 0 }))
      .resolves.toBeUndefined();
  });

  it('server receives the exact bytes sent', async () => {
    server.receivedBuffers = []; // reset
    await sendToPrinter(PAYLOAD, { host: '127.0.0.1', port, timeout: 1000, retries: 0 });
    expect(server.totalReceived).toEqual(PAYLOAD);
  });
});

describe('sendToPrinter — printer offline (ECONNREFUSED)', () => {
  it('rejects with offline message', async () => {
    const unusedPort = allocatePort(); // nothing listening here
    await expect(
      sendToPrinter(PAYLOAD, { host: '127.0.0.1', port: unusedPort, timeout: 1000, retries: 0 }),
    ).rejects.toThrow(/offline|ECONNREFUSED/i);
  });

  it('retries N times before rejecting', async () => {
    const unusedPort = allocatePort();
    const { logger } = await import('@/lib/logger');
    (logger.warn as jest.Mock).mockClear();

    await expect(
      sendToPrinter(PAYLOAD, { host: '127.0.0.1', port: unusedPort, timeout: 500, retries: 2 }),
    ).rejects.toThrow();

    // logger.warn should be called for each retry (2 retries = 2 warn calls)
    expect((logger.warn as jest.Mock).mock.calls.length).toBe(2);
  }, 10_000);
});

describe('sendToPrinter — timeout', () => {
  const server = new MockPrinterServer();
  let port: number;

  beforeAll(async () => {
    port = allocatePort();
    await server.start(port, 'timeout'); // accepts connection but never responds
  });

  afterAll(async () => { await server.stop(); });

  it('rejects with timeout message', async () => {
    await expect(
      sendToPrinter(PAYLOAD, { host: '127.0.0.1', port, timeout: 300, retries: 0 }),
    ).rejects.toThrow(/timeout/i);
  }, 5000);
});

describe('sendToPrinter — retry then succeed', () => {
  it('succeeds on second attempt when first fails', async () => {
    const port   = allocatePort();
    const server = new MockPrinterServer();

    // ครั้งแรก: port ปิด → ECONNREFUSED
    // ครั้งสอง: เปิด server ก่อนที่ retry จะเกิดขึ้น
    let started = false;
    const original = sendToPrinter;

    // Simulate: start server after 200ms (before 500ms retry delay)
    const delayedStart = new Promise<void>((resolve) => {
      setTimeout(async () => {
        await server.start(port, 'success');
        started = true;
        resolve();
      }, 100);
    });

    const result = sendToPrinter(PAYLOAD, {
      host: '127.0.0.1', port, timeout: 1000, retries: 2,
    });

    await delayedStart;
    await expect(result).resolves.toBeUndefined();
    expect(started).toBe(true);

    await server.stop();
  }, 10_000);
});

describe('sendToPrinter — concurrency', () => {
  const server = new MockPrinterServer();
  let port: number;

  beforeAll(async () => {
    port = allocatePort();
    await server.start(port, 'success');
  });

  afterAll(async () => { await server.stop(); });

  it('handles 10 concurrent print jobs without error', async () => {
    const jobs = Array.from({ length: 10 }, (_, i) =>
      sendToPrinter(Buffer.from([0x1b, 0x40, i]), {
        host: '127.0.0.1', port, timeout: 2000, retries: 1,
      }),
    );

    await expect(Promise.all(jobs)).resolves.toHaveLength(10);
    expect(server.connectionCount).toBe(10);
  }, 15_000);
});
