#!/usr/bin/env node
/**
 * Local Print Proxy
 * รับ HTTP POST จาก browser แล้วส่งต่อไป TCP printer (ESC/POS)
 *
 * Usage:
 *   node scripts/print-proxy.js
 *   node scripts/print-proxy.js --port 8080 --printer-host 192.168.1.121 --printer-port 9100
 */

const http = require('http');
const net  = require('net');

// ─── Config (แก้ตรงนี้ถ้าต้องการ) ────────────────────────────
const HTTP_PORT    = Number(process.env.PROXY_PORT)         || 8080;
const PRINTER_HOST = process.env.PRINTER_HOST               || '192.168.1.121';
const PRINTER_PORT = Number(process.env.PRINTER_PORT)       || 9100;
const TIMEOUT_MS   = 5000;
// ─────────────────────────────────────────────────────────────

function sendToPrinter(data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (err) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (err) reject(err); else resolve();
    };

    socket.setTimeout(TIMEOUT_MS);
    socket.on('connect', () => { socket.write(data, (err) => { if (err) finish(err); else socket.end(); }); });
    socket.on('end',     () => finish());
    socket.on('close',   () => finish());
    socket.on('timeout', () => finish(new Error(`Printer timeout — ${PRINTER_HOST}:${PRINTER_PORT}`)));
    socket.on('error',   (err) => finish(err));
    socket.connect(PRINTER_PORT, PRINTER_HOST);
  });
}

const server = http.createServer((req, res) => {
  // CORS — allow any localhost origin (browser → proxy)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST')    { res.writeHead(405); res.end('Method Not Allowed'); return; }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    try {
      await sendToPrinter(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      console.log(`[OK] sent ${body.length} bytes to ${PRINTER_HOST}:${PRINTER_PORT}`);
    } catch (err) {
      console.error(`[ERR] ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`Print proxy listening on http://localhost:${HTTP_PORT}/rawbt`);
  console.log(`Forwarding to ${PRINTER_HOST}:${PRINTER_PORT}`);
});
