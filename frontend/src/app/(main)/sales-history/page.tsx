"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Search, X, Receipt, Loader2, Ban, Printer,
  Download, ChevronDown, ChevronUp, RefreshCw,
  Clock, CheckCircle, AlertTriangle,
} from "lucide-react";
import { ordersApi } from "@/lib/api";
import { printReceipt } from "@/lib/printReceipt";
import { buildReceipt as buildThermalReceipt } from "@/lib/escpos/receiptFormatter";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import { STORE_INFO } from "@/constants/store";
import { useSettings } from "@/hooks/useSettings";

// ─── Types ─────────────────────────────────────────────────────
type OrderItem = {
  id: string;
  productNameTh?: string;
  productNameEn?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
};

type Order = {
  id: string;
  orderNo?: string | number;
  status: string;
  paymentMethod?: string;
  totalAmount: number;   // backend field name
  discount?: number;
  cashReceived?: number;
  change?: number;
  note?: string;
  paidAt?: string;
  createdAt: string;
  items?: OrderItem[];
  customer?: { nameTh?: string; nameEn?: string; name?: string } | null;
  cashier?: { nameTh?: string; nameEn?: string; name?: string } | null;
  dueDate?: string;
};

type ReceiptSettings = {
  receiptWidth?: number;
  headerText?: string;
  footerLines?: string[];
  footerLine1?: string;
  footerLine2?: string;
  footerLine3?: string;
};

type PrinterSettings = {
  printerIp?: string;
  printerPort?: number;
  codePage?: number;
  paperWidth?: 55 | 72;
  printMode?: string;
};

function paymentLabel(pm?: string) {
  const map: Record<string, string> = {
    cash: "เงินสด", qr: "QR", transfer: "โอน", cod: "เก็บปลายทาง", debt: "เชื่อ",
  };
  return map[pm || ""] || pm || "—";
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string }> = {
    confirmed: { label: "ชำระแล้ว",   color: "text-emerald-600 bg-emerald-50" },
    pending:   { label: "ค้างจ่าย",   color: "text-amber-600 bg-amber-50" },
    cancelled: { label: "ยกเลิกแล้ว", color: "text-red-500 bg-red-50" },
    claimed:   { label: "คืนสินค้า",  color: "text-purple-600 bg-purple-50" },
    packing:   { label: "กำลังแพ็ค",  color: "text-blue-600 bg-blue-50" },
    shipped:   { label: "จัดส่งแล้ว", color: "text-indigo-600 bg-indigo-50" },
    delivered: { label: "ส่งถึงแล้ว", color: "text-teal-600 bg-teal-50" },
  };
  return map[s] ?? { label: s, color: "text-gray-500 bg-gray-100" };
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("th-TH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Save element as PNG ────────────────────────────────────────
async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
    img.src = src;
  });
}

async function buildReceiptPngBlob(opts: {
  receiptText: string;
  widthMm: number;
  qrImageUrl?: string;
}): Promise<Blob> {
  const { receiptText, widthMm, qrImageUrl } = opts;
  const dpr = typeof window !== "undefined" ? Math.max(1, Math.floor(window.devicePixelRatio || 1)) : 1;

  // Use mm → px conversion suitable for screen export
  const pxPerMm = 12; // ~304dpi at dpr=1, good enough for PNG sharing
  const widthPx = Math.round(widthMm * pxPerMm * dpr);

  const fontSize = Math.round(12 * dpr);
  const lineHeight = Math.round(fontSize * 1.35);
  const padding = Math.round(8 * dpr);

  const lines = String(receiptText || "").split("\n");
  const qrSizePx = qrImageUrl ? Math.round(160 * dpr) : 0;
  const qrGap = qrImageUrl ? Math.round(10 * dpr) : 0;

  // Temporary canvas for measuring text
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) throw new Error("Canvas 2D context not available");
  mctx.font =
    `${fontSize}px ` +
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

  const maxTextWidth = lines.reduce((mx, l) => Math.max(mx, mctx.measureText(l).width), 0);
  const contentW = Math.min(widthPx, Math.max(padding * 2 + Math.ceil(maxTextWidth), Math.round(220 * dpr)));
  const textH = padding * 2 + lines.length * lineHeight;
  const contentH = textH + (qrImageUrl ? qrGap + qrSizePx + padding : 0);

  const canvas = document.createElement("canvas");
  canvas.width = contentW;
  canvas.height = contentH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  ctx.font =
    `${fontSize}px ` +
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

  let y = padding;
  for (const l of lines) {
    ctx.fillText(l, padding, y);
    y += lineHeight;
  }

  if (qrImageUrl) {
    const img = await loadImage(qrImageUrl);
    const x = Math.round((canvas.width - qrSizePx) / 2);
    y += qrGap;
    ctx.drawImage(img, x, y, qrSizePx, qrSizePx);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
    } catch (e) {
      reject(e);
    }
  });
  return blob;
}

async function saveAsPng(opts: { filename: string; receiptText: string; widthMm: number; qrImageUrl?: string }) {
  const blob = await buildReceiptPngBlob({
    receiptText: opts.receiptText,
    widthMm: opts.widthMm,
    qrImageUrl: opts.qrImageUrl,
  });
  const filename = opts.filename;

  const file = new File([blob], filename, { type: "image/png" });
  const canShareFiles =
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    typeof (navigator as unknown as { canShare?: (d: unknown) => boolean }).canShare === "function" &&
    (navigator as unknown as { canShare: (d: unknown) => boolean }).canShare({ files: [file] });

  if (canShareFiles && typeof (navigator as unknown as { share?: (d: unknown) => Promise<void> }).share === "function") {
    await (navigator as unknown as { share: (d: unknown) => Promise<void> }).share({
      files: [file],
      title: filename,
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  // iOS Safari often ignores the download attribute. Open the image in a new tab as a reliable fallback.
  if (isIOS) {
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }

  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ─── Receipt modal ──────────────────────────────────────────────
function ReceiptModal({
  order,
  receiptText,
  widthMm,
  onClose,
  onPrint,
  isPrinting,
}: {
  order: Order;
  receiptText: string;
  widthMm: number;
  onClose: () => void;
  onPrint: () => void;
  isPrinting: boolean;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleSavePng = async () => {
    if (!receiptRef.current) return;
    try {
      await saveAsPng({
        filename: `receipt-${order.orderNo || order.id}.png`,
        receiptText,
        widthMm,
        qrImageUrl: STORE_INFO.qrImageUrl,
      });
      toast.success("บันทึกรูปสำเร็จ");
    } catch (err) {
      // Surface the real error for troubleshooting (CORS/tainted canvas is common)
      console.error("saveAsPng failed:", err);
      const message =
        err instanceof Error ? err.message : "บันทึกรูปไม่สำเร็จ";
      toast.error(message || "บันทึกรูปไม่สำเร็จ");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="font-bold text-sm">ใบเสร็จ #{order.orderNo}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 bg-gray-50">
          <div ref={receiptRef}>
            <ReceiptPrint text={receiptText} widthMm={widthMm} qrImageUrl={STORE_INFO.qrImageUrl} />
          </div>
        </div>
        <div className="p-3 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={handleSavePng}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Download size={14} /> บันทึก PNG
          </button>
          <button
            onClick={onPrint}
            disabled={isPrinting}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {isPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            พิมพ์สำเนา
          </button>
          <button onClick={onClose} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cancel modal ───────────────────────────────────────────────
function CancelModal({
  order,
  onConfirm,
  onClose,
  isLoading,
}: {
  order: Order;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Ban size={18} className="text-red-500" />
          <h2 className="font-bold">ยกเลิกบิล #{order.orderNo}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          ยอด {Number(order.totalAmount).toLocaleString()} ฿ — กรุณาระบุเหตุผล
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผลที่ยกเลิก..."
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 resize-none mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(reason)}
            disabled={isLoading || !reason.trim()}
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            ยืนยันยกเลิก
          </button>
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mark paid modal ────────────────────────────────────────────
function MarkPaidModal({
  order,
  onConfirm,
  onClose,
  isLoading,
}: {
  order: Order;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle size={18} className="text-emerald-500" />
          <h2 className="font-bold">รับชำระบิล #{order.orderNo}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          ยืนยันรับชำระเงิน {Number(order.totalAmount).toLocaleString()} ฿ จากลูกค้า
          {(order.customer?.nameTh || order.customer?.name) ? ` (${order.customer?.nameTh || order.customer?.name})` : ""}?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            รับชำระแล้ว
          </button>
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order row ──────────────────────────────────────────────────
function OrderRow({
  order,
  onViewReceipt,
  onCancel,
  onMarkPaid,
}: {
  order: Order;
  onViewReceipt: (o: Order) => void;
  onCancel: (o: Order) => void;
  onMarkPaid: (o: Order) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const st = statusLabel(order.status);
  const canCancel = ["confirmed", "pending", "packing"].includes(order.status);
  const canMarkPaid = order.status === "pending";

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      {/* Summary row */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">#{order.orderNo}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
            {order.paymentMethod && (
              <span className="text-xs text-gray-400">{paymentLabel(order.paymentMethod)}</span>
            )}
            {(order.customer?.nameTh || order.customer?.name) && (
              <span className="text-xs text-blue-500 truncate">{order.customer.nameTh || order.customer.name}</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{fmtDate(order.paidAt || order.createdAt)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold text-gray-900">{Number(order.totalAmount).toLocaleString()} ฿</div>
          {(order.discount ?? 0) > 0 && (
            <div className="text-xs text-red-400">ลด {Number(order.discount).toLocaleString()}</div>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-3 pt-2 space-y-2">
          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-1">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-gray-600">
                  <span className="truncate flex-1 mr-2">{item.productNameTh || item.productNameEn || "—"}</span>
                  <span className="text-gray-400 shrink-0">x{item.quantity}</span>
                  <span className="font-medium tabular-nums ml-3 shrink-0">{Number(item.unitPrice).toLocaleString()} ฿</span>
                </div>
              ))}
            </div>
          )}
          {order.note && (
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-2 py-1">หมายเหตุ: {order.note}</div>
          )}
          {order.dueDate && (
            <div className="text-xs text-amber-600 flex items-center gap-1">
              <Clock size={11} /> ครบกำหนด {fmtDate(order.dueDate)}
            </div>
          )}
          {/* Action buttons */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button
              onClick={() => onViewReceipt(order)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-medium flex items-center gap-1.5 text-gray-700"
            >
              <Receipt size={13} /> ดูใบเสร็จ
            </button>
            {canMarkPaid && (
              <button
                onClick={() => onMarkPaid(order)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-xs font-medium flex items-center gap-1.5 text-emerald-700"
              >
                <CheckCircle size={13} /> รับชำระ
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => onCancel(order)}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-medium flex items-center gap-1.5 text-red-600"
              >
                <Ban size={13} /> ยกเลิกบิล
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────
export default function SalesHistoryPage() {
  const { data: session } = useSession();
  const cashierName =
    (session?.user as Record<string, string> | null | undefined)?.nameEn ||
    (session?.user as Record<string, string> | null | undefined)?.nameTh ||
    session?.user?.name || "cashier";

  const { data: receiptSettings } = useSettings<ReceiptSettings>("receipt");
  const { data: printerSettings } = useSettings<PrinterSettings>("printer");

  const widthMm = receiptSettings?.receiptWidth ?? 55;

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;

  // Modals
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [markPaidOrder, setMarkPaidOrder] = useState<Order | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const loadOrders = useCallback(async (reset = true) => {
    setIsLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const res = await ordersApi.list({
        search: search || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      // Backend returns { items, total, page, limit, totalPages }
      const payload = res.data as { items?: Order[]; total?: number } | Order[];
      const rows: Order[] = Array.isArray(payload)
        ? payload
        : (payload.items ?? []);
      if (reset) {
        setOrders(rows);
        setPage(1);
      } else {
        setOrders((prev) => [...prev, ...rows]);
      }
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      toast.error("โหลดประวัติการขายไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => { loadOrders(true); }, [statusFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders(true);
  };

  // Build receipt text for an order
  const buildReceiptText = (order: Order): string => {
    const headerLines = [
      receiptSettings?.headerText?.trim() || STORE_INFO.name,
      STORE_INFO.tagline, STORE_INFO.address, STORE_INFO.phone,
    ];
    const footerLines = (() => {
      const fl = Array.isArray(receiptSettings?.footerLines)
        ? receiptSettings!.footerLines.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [];
      if (fl.length > 0) return fl;
      const legacy = [receiptSettings?.footerLine1, receiptSettings?.footerLine2, receiptSettings?.footerLine3]
        .map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
      return legacy.length > 0 ? legacy : [...STORE_INFO.footerLines];
    })();

    return buildThermalReceipt({
      headerLines,
      receiptNo: String(order.orderNo || "—"),
      issuedAt: order.paidAt ? new Date(order.paidAt) : new Date(order.createdAt),
      cashierName: order.cashier?.nameEn || order.cashier?.nameTh || order.cashier?.name || cashierName,
      items: (order.items || []).map((i) => ({
        name: String(i.productNameTh || i.productNameEn || ""),
        qty: Number(i.quantity || 0),
        price: Number(i.unitPrice || 0),
      })),
      discount: Number(order.discount) || 0,
      total: Number(order.totalAmount || 0),
      paymentMethodLabel: paymentLabel(order.paymentMethod),
      cash: typeof order.cashReceived === "number" ? order.cashReceived : undefined,
      change: typeof order.change === "number" ? order.change : undefined,
      footerLines,
    });
  };

  // View receipt — load full order with items if needed
  const handleViewReceipt = async (order: Order) => {
    if (!order.items) {
      try {
        const res = await ordersApi.byId(order.id);
        setReceiptOrder(res.data as Order);
      } catch { setReceiptOrder(order); }
    } else {
      setReceiptOrder(order);
    }
  };

  // Print receipt
  const handlePrint = async (order: Order) => {
    setIsPrinting(true);
    try {
      await printReceipt(
        {
          headerLines: [receiptSettings?.headerText?.trim() || STORE_INFO.name, STORE_INFO.tagline, STORE_INFO.address, STORE_INFO.phone],
          receiptNo: String(order.orderNo || "—"),
          issuedAt: order.paidAt ? new Date(order.paidAt) : new Date(order.createdAt),
          cashierName: order.cashier?.nameEn || order.cashier?.nameTh || order.cashier?.name || cashierName,
          items: (order.items || []).map((i) => ({
            name: String(i.productNameTh || i.productNameEn || ""),
            qty: Number(i.quantity || 0),
            price: Number(i.unitPrice || 0),
          })),
          discount: Number(order.discount) || 0,
          total: Number(order.totalAmount || 0),
          paymentMethodLabel: paymentLabel(order.paymentMethod),
          cash: typeof order.cashReceived === "number" ? order.cashReceived : undefined,
          change: typeof order.change === "number" ? order.change : undefined,
          codePage: printerSettings?.codePage,
          paperWidthMm: printerSettings?.paperWidth,
        },
        printerSettings?.printMode === "RAWBT"
          ? undefined
          : { host: printerSettings?.printerIp || "192.168.1.121", port: printerSettings?.printerPort || 9100 },
      );
      toast.success("พิมพ์สำเร็จ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "พิมพ์ไม่สำเร็จ");
    } finally {
      setIsPrinting(false);
    }
  };

  // Cancel order
  const handleCancel = async (reason: string) => {
    if (!cancelOrder) return;
    setIsCancelling(true);
    try {
      await ordersApi.cancel(cancelOrder.id, reason);
      toast.success("ยกเลิกบิลสำเร็จ");
      setCancelOrder(null);
      loadOrders(true);
    } catch {
      toast.error("ยกเลิกบิลไม่สำเร็จ");
    } finally {
      setIsCancelling(false);
    }
  };

  // Mark PENDING → PAID
  const handleMarkPaid = async () => {
    if (!markPaidOrder) return;
    setIsMarkingPaid(true);
    try {
      await ordersApi.updateStatus(markPaidOrder.id, "PAID");
      toast.success("รับชำระเงินสำเร็จ");
      setMarkPaidOrder(null);
      loadOrders(true);
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Receipt size={18} className="text-orange-500" />
          <h1 className="font-bold text-sm">ประวัติการขาย</h1>
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={11} /> {pendingCount} ค้างจ่าย
            </span>
          )}
          <button
            onClick={() => loadOrders(true)}
            disabled={isLoading}
            className="ml-auto w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Search + filters */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขบิล, ลูกค้า..."
              className="w-full border border-gray-200 rounded-xl pl-8 pr-8 py-2 text-sm outline-none focus:border-orange-400"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(""); loadOrders(true); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="confirmed">ชำระแล้ว</option>
              <option value="pending">ค้างจ่าย</option>
              <option value="cancelled">ยกเลิก</option>
              <option value="claimed">คืนสินค้า</option>
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white" />
            <button type="submit"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
              ค้นหา
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading && orders.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> กำลังโหลด...
          </div>
        ) : orders.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
            <AlertTriangle size={28} />
            <span className="text-sm">ไม่พบรายการขาย</span>
          </div>
        ) : (
          <>
            {orders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                onViewReceipt={handleViewReceipt}
                onCancel={setCancelOrder}
                onMarkPaid={setMarkPaidOrder}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => { setPage((p) => p + 1); loadOrders(false); }}
                disabled={isLoading}
                className="w-full py-3 border border-gray-200 rounded-2xl text-sm text-gray-500 hover:bg-gray-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                โหลดเพิ่มเติม
              </button>
            )}
          </>
        )}
      </div>

      {/* Receipt modal */}
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          receiptText={buildReceiptText(receiptOrder)}
          widthMm={widthMm}
          onClose={() => setReceiptOrder(null)}
          onPrint={() => handlePrint(receiptOrder)}
          isPrinting={isPrinting}
        />
      )}

      {/* Cancel modal */}
      {cancelOrder && (
        <CancelModal
          order={cancelOrder}
          onConfirm={handleCancel}
          onClose={() => setCancelOrder(null)}
          isLoading={isCancelling}
        />
      )}

      {/* Mark paid modal */}
      {markPaidOrder && (
        <MarkPaidModal
          order={markPaidOrder}
          onConfirm={handleMarkPaid}
          onClose={() => setMarkPaidOrder(null)}
          isLoading={isMarkingPaid}
        />
      )}
    </div>
  );
}
