/**
 * Integration tests — full pipeline
 * receiptFormatter → receiptBuilder → printerService (mock TCP)
 * ทดสอบว่า buffer ที่ส่งไปเครื่องพิมพ์ถูกต้องทั้งหมด
 */

import { buildReceipt }      from '@/lib/escpos/receiptBuilder';
import { sendToPrinter }     from '@/lib/escpos/printerService';
import { assertWidth }       from '@/lib/escpos/receiptFormatter';
import { MockPrinterServer, allocatePort } from '../helpers/mockPrinter';
import { makeReceiptData, makeItems }     from '../helpers/testData';

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Full receipt pipeline', () => {
  const server = new MockPrinterServer();
  let port: number;

  beforeAll(async () => {
    port = allocatePort();
    await server.start(port, 'success');
  });

  afterAll(async () => { await server.stop(); });

  beforeEach(() => {
    server.receivedBuffers = [];
  });

  it('sends valid ESC/POS buffer to printer', async () => {
    const data   = makeReceiptData();
    const buffer = buildReceipt(data);

    await sendToPrinter(buffer, { host: '127.0.0.1', port, timeout: 2000, retries: 0 });

    expect(server.totalReceived.length).toBeGreaterThan(0);
    expect(server.totalReceived).toEqual(buffer);
  });

  it('receipt text inside buffer respects 48-char width', () => {
    const data = makeReceiptData({ items: makeItems(10), total: 9999 });
    // assertWidth validates the text before encoding — no throw = pass
    const { buildReceipt: formatReceipt } = jest.requireActual('@/lib/escpos/receiptFormatter') as typeof import('@/lib/escpos/receiptFormatter');
    expect(() => assertWidth(formatReceipt(data))).not.toThrow();
  });

  it('cash drawer command appears after cut in sent buffer', async () => {
    const data   = makeReceiptData({ openDrawer: true });
    const buffer = buildReceipt(data);

    await sendToPrinter(buffer, { host: '127.0.0.1', port, timeout: 2000, retries: 0 });

    const received  = server.totalReceived;
    const cutIdx    = received.indexOf(Buffer.from([0x1d, 0x56, 0x41, 0x0a]));
    const drawerIdx = received.indexOf(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));

    expect(cutIdx).toBeGreaterThan(-1);
    expect(drawerIdx).toBeGreaterThan(cutIdx);
  });

  it('non-cash payment does NOT include cash drawer command', async () => {
    const data   = makeReceiptData({ openDrawer: false });
    const buffer = buildReceipt(data);

    await sendToPrinter(buffer, { host: '127.0.0.1', port, timeout: 2000, retries: 0 });

    const received = server.totalReceived;
    const drawerIdx = received.indexOf(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    expect(drawerIdx).toBe(-1);
  });

  it('sends 5 receipts sequentially without data corruption', async () => {
    const receipts = Array.from({ length: 5 }, (_, i) =>
      buildReceipt(makeReceiptData({ receiptNo: `SEQ-${String(i).padStart(3, '0')}` })),
    );

    for (const buf of receipts) {
      server.receivedBuffers = [];
      await sendToPrinter(buf, { host: '127.0.0.1', port, timeout: 2000, retries: 0 });
      expect(server.totalReceived).toEqual(buf);
    }
  });
});

describe('Pipeline — printer offline error handling', () => {
  it('throws descriptive error when printer is unreachable', async () => {
    const unusedPort = allocatePort();
    const data       = makeReceiptData();
    const buffer     = buildReceipt(data);

    await expect(
      sendToPrinter(buffer, { host: '127.0.0.1', port: unusedPort, timeout: 500, retries: 0 }),
    ).rejects.toThrow(/offline|ECONNREFUSED/i);
  });

  it('receipt formatter still works when printer is offline', () => {
    // formatter มีความสามารถอิสระจาก TCP
    const data   = makeReceiptData({ items: makeItems(20), total: 9999 });
    const buffer = buildReceipt(data);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
