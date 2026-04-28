import type { ReceiptData } from "./receiptBuilder";

type PaperWidthMm = 55 | 72;

function mmToDots(mm: number, dpi = 203): number {
  return Math.round((mm / 25.4) * dpi);
}

function money(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function hasThai(s: string): boolean {
  return /[\u0E00-\u0E7F]/.test(s);
}

function receiptLikelyNeedsImage(r: ReceiptData): boolean {
  const texts: string[] = [];
  if (Array.isArray(r.headerLines)) texts.push(...r.headerLines);
  if (Array.isArray(r.footerLines)) texts.push(...r.footerLines);
  if (r.cashierName) texts.push(r.cashierName);
  if (r.paymentMethodLabel) texts.push(r.paymentMethodLabel);
  for (const it of r.items || []) texts.push(it.name);
  return texts.some((t) => hasThai(String(t ?? "")));
}

function wrapByWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let start = 0;
  while (start < chars.length) {
    let end = chars.length;
    let low = start + 1;
    let high = chars.length;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const s = chars.slice(start, mid).join("");
      const w = ctx.measureText(s).width;
      if (w <= maxWidth) {
        end = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (end <= start) end = Math.min(start + 1, chars.length);
    lines.push(chars.slice(start, end).join(""));
    start = end;
  }
  return lines.length ? lines : [""];
}

function canvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context not available");

  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const bytesPerRow = Math.ceil(width / 8);
  const out = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = image.data[i]!;
      const g = image.data[i + 1]!;
      const b = image.data[i + 2]!;
      const a = image.data[i + 3]!;
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) * (a / 255);
      const black = lum < 160;
      if (black) {
        const idx = y * bytesPerRow + (x >> 3);
        out[idx] |= 0x80 >> (x & 7);
      }
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const full = new Uint8Array(header.length + out.length);
  full.set(header, 0);
  full.set(out, header.length);
  return full;
}

export function shouldUseImageMode(receipt: ReceiptData): boolean {
  return receiptLikelyNeedsImage(receipt);
}

export function buildImageReceiptPayload(
  receipt: ReceiptData,
  opts?: { paperWidthMm?: PaperWidthMm; codePage?: number },
): Uint8Array {
  const paperWidthMm = opts?.paperWidthMm ?? 58;
  const dots = mmToDots(paperWidthMm);

  const canvas = document.createElement("canvas");
  canvas.width = dots;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const fontSize = paperWidthMm === 58 ? 22 : 24;
  const lineHeight = Math.round(fontSize * 1.25);
  const padX = Math.round(dots * 0.04);
  const maxW = dots - padX * 2;

  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, 10);
  ctx.fillStyle = "#000";
  ctx.font =
    `${fontSize}px ` +
    "Tahoma, 'Noto Sans Thai', 'Sarabun', Arial, sans-serif";

  const lines: { kind: "text"; text: string; align?: CanvasTextAlign }[] = [];

  const headerLines = (receipt.headerLines ?? [])
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  for (const l of headerLines) lines.push({ kind: "text", text: l, align: "center" });
  if (receipt.receiptNo) lines.push({ kind: "text", text: `#${receipt.receiptNo}`, align: "center" });
  if (receipt.issuedAt) lines.push({ kind: "text", text: formatDate(receipt.issuedAt), align: "center" });
  if (receipt.cashierName) lines.push({ kind: "text", text: `Cashier: ${receipt.cashierName}`, align: "center" });

  const sep = "=".repeat(paperWidthMm === 58 ? 32 : 42);
  lines.push({ kind: "text", text: sep, align: "left" });

  // Table columns (pixels)
  const colQty = Math.round(maxW * 0.12);
  const colPrice = Math.round(maxW * 0.22);
  const colTotal = Math.round(maxW * 0.22);
  const colName = maxW - colQty - colPrice - colTotal;

  // Pre-calc subtotal/vat
  const subtotal = receipt.items.reduce((s, i) => s + i.qty * i.price, 0);
  const discount = typeof receipt.discount === "number" ? receipt.discount : 0;
  const baseForVat = Math.max(0, subtotal - discount);
  const vatRate = typeof receipt.vatRate === "number" ? receipt.vatRate : 0;
  const vat =
    typeof receipt.vat === "number"
      ? receipt.vat
      : Number((baseForVat * vatRate).toFixed(2));

  // We will draw everything in a single pass, but need to compute height
  let y = 0;
  const reservedExtra = lineHeight * 8 + 40;
  canvas.height = 400 + receipt.items.length * lineHeight * 2 + reservedExtra;

  // reset after resizing
  const ctx2 = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx2.textBaseline = "top";
  ctx2.fillStyle = "#fff";
  ctx2.fillRect(0, 0, canvas.width, canvas.height);
  ctx2.fillStyle = "#000";
  ctx2.font =
    `${fontSize}px ` +
    "Tahoma, 'Noto Sans Thai', 'Sarabun', Arial, sans-serif";

  const drawTextLine = (text: string, align: CanvasTextAlign = "left") => {
    ctx2.textAlign = align;
    const x =
      align === "center" ? canvas.width / 2 : align === "right" ? canvas.width - padX : padX;
    ctx2.fillText(text, x, y);
    y += lineHeight;
  };

  for (const l of lines) drawTextLine(l.text, l.align);

  // Table header
  ctx2.textAlign = "left";
  const headerY = y;
  ctx2.fillText("Name", padX, headerY);
  ctx2.textAlign = "right";
  ctx2.fillText("Qty", padX + colName + colQty, headerY);
  ctx2.fillText("Price", padX + colName + colQty + colPrice, headerY);
  ctx2.fillText("Total", padX + colName + colQty + colPrice + colTotal, headerY);
  y += lineHeight;
  drawTextLine("-".repeat(paperWidthMm === 58 ? 32 : 42), "left");

  // Items
  for (const it of receipt.items) {
    const nameLines = wrapByWidth(ctx2, it.name, colName);
    const firstY = y;
    ctx2.textAlign = "left";
    ctx2.fillText(nameLines[0] ?? "", padX, firstY);
    ctx2.textAlign = "right";
    ctx2.fillText(String(it.qty), padX + colName + colQty, firstY);
    ctx2.fillText(money(it.price), padX + colName + colQty + colPrice, firstY);
    ctx2.fillText(money(it.qty * it.price), padX + colName + colQty + colPrice + colTotal, firstY);
    y += lineHeight;
    for (let i = 1; i < nameLines.length; i++) {
      ctx2.textAlign = "left";
      ctx2.fillText(nameLines[i] ?? "", padX, y);
      y += lineHeight;
    }
  }

  drawTextLine(sep, "left");

  const summaryRow = (label: string, value: string) => {
    ctx2.textAlign = "left";
    ctx2.fillText(label, padX, y);
    ctx2.textAlign = "right";
    ctx2.fillText(value, canvas.width - padX, y);
    y += lineHeight;
  };

  summaryRow("SUBTOTAL", money(subtotal));
  summaryRow("DISCOUNT", money(discount));
  summaryRow(`VAT ${(vatRate * 100).toFixed(0)}%`, money(vat));
  drawTextLine("-".repeat(paperWidthMm === 58 ? 32 : 42), "left");
  summaryRow("TOTAL", money(receipt.total));
  if (receipt.paymentMethodLabel) {
    drawTextLine(`PAYMENT: ${receipt.paymentMethodLabel}`, "left");
  }
  if (typeof receipt.cash === "number") summaryRow("CASH", money(receipt.cash));
  if (typeof receipt.change === "number") summaryRow("CHANGE", money(receipt.change));

  drawTextLine("-".repeat(paperWidthMm === 58 ? 32 : 42), "left");

  const footerLines = (receipt.footerLines ?? [])
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  for (const l of footerLines) drawTextLine(l, "center");

  // Crop canvas to content
  const finalH = Math.min(canvas.height, y + lineHeight * 2);
  const cropped = document.createElement("canvas");
  cropped.width = canvas.width;
  cropped.height = finalH;
  const cctx = cropped.getContext("2d", { willReadFrequently: true })!;
  cctx.fillStyle = "#fff";
  cctx.fillRect(0, 0, cropped.width, cropped.height);
  cctx.drawImage(canvas, 0, 0);

  const codePage = typeof receipt.codePage === "number" ? receipt.codePage : (opts?.codePage ?? 70);
  const init = new Uint8Array([0x1b, 0x40, 0x1c, 0x2e, 0x1b, 0x74, codePage & 0xff, 0x1b, 0x61, 0x00]);
  const raster = canvasToEscPosRaster(cropped);
  const feedCut = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x41, 0x0a]);

  const openDrawer =
    receipt.openDrawer ? new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]) : new Uint8Array([]);

  const totalLen = init.length + raster.length + feedCut.length + openDrawer.length;
  const payload = new Uint8Array(totalLen);
  let off = 0;
  payload.set(init, off); off += init.length;
  payload.set(raster, off); off += raster.length;
  payload.set(feedCut, off); off += feedCut.length;
  payload.set(openDrawer, off);

  return payload;
}
