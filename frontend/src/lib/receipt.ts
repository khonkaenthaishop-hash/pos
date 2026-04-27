export type CharsPerLine = 48 | 64;

export type ReceiptLineItem = {
  name: string;
  qty: number;
  price: number;
};

export type ReceiptPayment = {
  methodLabel: string;
  received?: number;
  change?: number;
};

export type BuildReceiptInput = {
  receiptNo: string;
  issuedAt: Date;
  cashierName: string;
  items: ReceiptLineItem[];
  discount: number;
  vatRate: number;
  total?: number; // override computed total
  payment: ReceiptPayment;
};

function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  if (text.length >= width) return text.slice(text.length - width);
  return " ".repeat(width - text.length) + text;
}

function money(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function line(width: number, ch = "-"): string {
  return ch.repeat(width);
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export function buildReceiptText(
  input: BuildReceiptInput,
  opts?: {
    charsPerLine?: CharsPerLine;
    store?: { headerLines: string[]; footerLines?: string[] };
  },
): string {
  const width = opts?.charsPerLine ?? 48;
  const headerLines = opts?.store?.headerLines ?? [];
  const footerLines = opts?.store?.footerLines ?? [];

  const subtotal = input.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = input.discount || 0;
  const baseForVat = Math.max(0, subtotal - discount);
  const vat = Number((baseForVat * input.vatRate).toFixed(2));
  const net =
    input.total != null ? input.total : Number((baseForVat + vat).toFixed(2));

  const qtyWidth = 4;
  const priceWidth = 7;
  const totalWidth = 7;
  const nameWidth = Math.max(6, width - qtyWidth - priceWidth - totalWidth);

  const out: string[] = [];
  for (const l of headerLines) out.push(l);
  if (headerLines.length) out.push(line(width));

  out.push("RECEIPT");
  out.push(`No: ${input.receiptNo}`);
  out.push(`Date: ${formatDate(input.issuedAt)}`);
  out.push(`Cashier: ${input.cashierName}`);
  out.push(line(width));

  out.push(
    padRight("Item", nameWidth) +
      padLeft("Qty", qtyWidth) +
      padLeft("Price", priceWidth) +
      padLeft("Amt", totalWidth),
  );
  out.push(line(width));

  for (const item of input.items) {
    const lineTotal = item.qty * item.price;
    out.push(
      padRight(item.name, nameWidth) +
        padLeft(String(item.qty), qtyWidth) +
        padLeft(money(item.price), priceWidth) +
        padLeft(money(lineTotal), totalWidth),
    );
  }

  out.push(line(width));
  out.push(
    padRight("Subtotal", width - priceWidth) +
      padLeft(money(subtotal), priceWidth),
  );
  out.push(
    padRight("Discount", width - priceWidth) +
      padLeft(money(discount), priceWidth),
  );
  out.push(
    padRight(`VAT ${(input.vatRate * 100).toFixed(0)}%`, width - priceWidth) +
      padLeft(money(vat), priceWidth),
  );
  out.push(line(width));
  out.push(
    padRight("TOTAL", width - priceWidth) + padLeft(money(net), priceWidth),
  );
  out.push(line(width));

  out.push(`Payment: ${input.payment.methodLabel}`);
  if (typeof input.payment.received === "number") {
    out.push(
      padRight("Cash:", width - priceWidth) +
        padLeft(money(input.payment.received), priceWidth),
    );
  }
  if (typeof input.payment.change === "number") {
    out.push(
      padRight("Change:", width - priceWidth) +
        padLeft(money(input.payment.change), priceWidth),
    );
  }

  out.push(line(width));
  out.push("");

  for (const l of footerLines) out.push(l);

  return out.join("\n");
}
