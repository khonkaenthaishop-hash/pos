'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { getProductScanMeta } from '@/lib/utils';
import {
  Banknote, CheckCircle, CreditCard, Loader2, Plus, QrCode,
  Receipt, Search, Tag, Trash2, X, Minus, User, PauseCircle,
  PlayCircle, AlertTriangle, RotateCcw, BarChart2, Lock,
} from 'lucide-react';

import { authApi, cashierSessionsApi, categoriesApi, customersApi, heldOrdersApi, locationsApi, ordersApi, productsApi } from '@/lib/api';
import { printReceipt } from '@/lib/printReceipt';
import { STORE_INFO } from '@/constants/store';
import { buildReceiptText } from '@/lib/receipt';
import { useSettings } from '@/hooks/useSettings';
import { ReceiptPrint } from '@/components/ReceiptPrint';
import CustomerDropdown, { Customer } from '@/components/pos/CustomerDropdown';
import SlipUpload from '@/components/pos/SlipUpload';

// ─── Types ─────────────────────────────────────────────────────
type Category = { id: string; nameTh: string; icon?: string | null };

type Product = Record<string, unknown> & {
  id: string;
  nameTh: string;
  nameEn?: string | null;
  retailPrice: number;
  wholesalePrice?: number | null;
  conversionFactor?: number | null;
  promoQty?: number | null;
  promoPrice?: number | null;
  currentStock?: number | null;
  minStock?: number | null;
  imageUrl?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  isApproved?: boolean;
};

type CartItem = {
  id: string;
  nameTh: string;
  nameEn?: string | null;
  retailPrice: number;
  qty: number;
  unitQty: number;
  packQty: number;
  ratio: number;
  packPrice: number | null;
  promoQty: number | null;
  promoPrice: number | null;
  itemDiscount: number;
  discountMode: 'auto' | 'manual';
  pickLocation?: string;
};

type Bill = {
  id: string;
  label: string;
  cart: CartItem[];
  customer: Customer | null;
  discount: number;
  note: string;
};

type CreatedOrder = Record<string, unknown> & {
  orderNo?: string;
  paidAt?: string;
  paymentMethod?: string;
  discount?: number;
  total?: number;
  cashReceived?: number;
  change?: number;
  items?: Array<{ productNameTh: string; productNameEn?: string; quantity: number; unitPrice: number }>;
};

type PaymentMethodType = 'cash' | 'qr' | 'transfer' | 'cod';

type HeldSummary = {
  id: string;
  label: string;
  itemCount: number;
  totalQty: number;
  customerName: string | null;
  discount: number;
  createdAt: string;
};

type ReceiptSettings = {
  headerText?: string;
  footerLines?: string[];
  footerLine1?: string;
  footerLine2?: string;
  footerLine3?: string;
};

type CashierSession = {
  id: string;
  date: string;
  openingAmount: number;
  closingAmount: number | null;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
};

const MAX_DEBT = 2000;
const LOYALTY_RATE = 0.01; // 1 point per 100 THB

function money(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function round2(n: number): number {
  return Number(Number(n).toFixed(2));
}

function computePromoDiscount(unitQty: number, retailPrice: number, promoQty: number | null, promoPrice: number | null): number {
  const q = Math.floor(Number(unitQty) || 0);
  const pq = promoQty != null ? Math.floor(Number(promoQty) || 0) : 0;
  const pp = promoPrice != null ? Number(promoPrice) : NaN;
  if (q <= 0 || pq <= 1 || !Number.isFinite(pp) || pp <= 0) return 0;
  const bundles = Math.floor(q / pq);
  if (bundles <= 0) return 0;
  const normal = bundles * pq * retailPrice;
  const promo = bundles * pp;
  return Math.max(0, round2(normal - promo));
}

function computePackDiscount(packQty: number, ratio: number, retailPrice: number, packPrice: number | null): number {
  const pk = Math.floor(Number(packQty) || 0);
  const r = Math.max(1, Math.floor(Number(ratio) || 1));
  if (pk <= 0 || r <= 1) return 0;
  const effectivePackPrice = (packPrice != null && Number.isFinite(packPrice) && packPrice > 0)
    ? Number(packPrice)
    : retailPrice * r;
  const normal = pk * r * retailPrice;
  const desired = pk * effectivePackPrice;
  return Math.max(0, round2(normal - desired));
}

function applyAutoPricing(item: CartItem): CartItem {
  if (item.discountMode === 'manual') return item;
  const totalQty = Math.max(0, Math.floor(item.qty));
  const ratio = Math.max(1, Math.floor(item.ratio));
  const packQty = Math.max(0, Math.floor(item.packQty));
  const unitQty = Math.max(0, Math.floor(item.unitQty));
  const retail = Math.max(0, Number(item.retailPrice) || 0);

  const baseTotal = totalQty * retail;
  const promoDisc = computePromoDiscount(unitQty, retail, item.promoQty, item.promoPrice);
  const packDisc = computePackDiscount(packQty, ratio, retail, item.packPrice);
  const discount = Math.max(0, round2(promoDisc + packDisc));

  // Guard: never discount more than the base total
  return { ...item, itemDiscount: Math.min(discount, round2(baseTotal)) };
}

function paymentMethodLabel(pm: string | undefined): string {
  const map: Record<string, string> = { cash: 'เงินสด', qr: 'QR', transfer: 'โอน', cod: 'เก็บปลายทาง' };
  return map[pm || ''] || pm || '—';
}

function newBill(id?: string): Bill {
  return {
    id: id || `bill_${Date.now()}`,
    label: `บิลใหม่`,
    cart: [],
    customer: null,
    discount: 0,
    note: '',
  };
}

// ─── Main Component ────────────────────────────────────────────
export default function PosPage() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, string> | null | undefined)?.role || '';
  const cashierName =
    (session?.user as Record<string, string> | null | undefined)?.nameEn ||
    (session?.user as Record<string, string> | null | undefined)?.nameTh ||
    session?.user?.name || session?.user?.email || 'cashier';

  const searchRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  // ─── Cashier Session ──────────────────────────────────────────
  // null  = not loaded yet (show spinner)
  // false = loaded, no session today (show open-cash modal)
  // CashierSession = loaded, session exists
  const [cashierSession, setCashierSession] = useState<CashierSession | null | false>(null);
  const [openingInput, setOpeningInput] = useState('');
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [isSettingOpening, setIsSettingOpening] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [closingInput, setClosingInput] = useState('');

  // ─── Catalog ──────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // ─── Multi-Bill (tabs) ────────────────────────────────────────
  const [bills, setBills] = useState<Bill[]>([newBill('bill_1')]);
  const [activeBillId, setActiveBillId] = useState('bill_1');
  const [heldBills, setHeldBills] = useState<HeldSummary[]>([]);
  const [showHeldPanel, setShowHeldPanel] = useState(false);

  // ─── Checkout ─────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [cashInput, setCashInput] = useState('');
  const [includeVat, setIncludeVat] = useState(false);
  const [isDebt, setIsDebt] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [slipUrl, setSlipUrl] = useState('');
  const [isCheckout, setIsCheckout] = useState(false);

  // ─── Manager password modal ───────────────────────────────────
  const [showPassModal, setShowPassModal] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<{ itemId?: string; amount: number } | null>(null);
  const DISCOUNT_LIMIT = 50;

  // ─── Receipt ──────────────────────────────────────────────────
  const [receiptOrder, setReceiptOrder] = useState<CreatedOrder | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: receiptSettings } = useSettings<ReceiptSettings>('receipt');
  const { data: printerSettings } = useSettings<{ printerIp?: string; printerPort?: number }>('printer');
  const receiptHeaderLines = useMemo(() => {
    const first = receiptSettings?.headerText?.trim() || STORE_INFO.name;
    return [first, STORE_INFO.tagline, STORE_INFO.address, STORE_INFO.phone];
  }, [receiptSettings]);

  const receiptFooterLines = useMemo(() => {
    const footerLines = Array.isArray(receiptSettings?.footerLines)
      ? receiptSettings!.footerLines.map((v) => String(v ?? '').trim()).filter(Boolean)
      : [];
    if (footerLines.length > 0) return footerLines;

    const legacy = [
      receiptSettings?.footerLine1,
      receiptSettings?.footerLine2,
      receiptSettings?.footerLine3,
    ].map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);

    return legacy.length > 0 ? legacy : [...STORE_INFO.footerLines];
  }, [receiptSettings]);

  // ─── Return modal ─────────────────────────────────────────────
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnOrder, setReturnOrder] = useState<CreatedOrder | null>(null);
  const [isFetchingReturn, setIsFetchingReturn] = useState(false);
  const [isReturning, setIsReturning] = useState(false);

  // ─── X/Z Report ───────────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // ─── Active bill helpers ──────────────────────────────────────
  const activeBill = bills.find(b => b.id === activeBillId) || bills[0];

  const updateActiveBill = useCallback((updater: (b: Bill) => Bill) => {
    setBills(prev => prev.map(b => b.id === activeBillId ? updater(b) : b));
  }, [activeBillId]);

  const cart = useMemo(() => activeBill?.cart || [], [activeBill]);
  const customer = activeBill?.customer || null;
  const discountInput = activeBill?.discount ?? 0;
  const note = activeBill?.note || '';

  // ─── Totals ───────────────────────────────────────────────────
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + (item.retailPrice * item.qty) - item.itemDiscount, 0),
    [cart],
  );
  const discount = Math.max(0, discountInput || 0);
  const baseForVat = Math.max(0, subtotal - discount);
  const vatAmount = includeVat ? Number((baseForVat * 0.07).toFixed(2)) : 0;
  const netTotal = Number((baseForVat + vatAmount).toFixed(2));
  const change = paymentMethod === 'cash' ? Math.max(0, (Number(cashInput) || 0) - netTotal) : 0;
  const loyaltyPoints = Math.floor(netTotal * LOYALTY_RATE);

  // ─── Load today's cashier session on mount ────────────────────
  useEffect(() => {
    cashierSessionsApi.getToday()
      .then(r => {
        const s = r.data as CashierSession | null;
        if (s) {
          setCashierSession(s);
        } else {
          setCashierSession(false);
          setShowOpeningModal(true);
        }
      })
      .catch(() => {
        setCashierSession(false);
        setShowOpeningModal(true);
      });
  }, []);

  // ─── Load catalog ─────────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesApi.list();
      setCategories((res.data || []) as Category[]);
    } catch { /* non-critical */ }
  }, []);

  const loadProducts = useCallback(async (opts?: { search?: string; categoryId?: string }) => {
    setIsLoadingProducts(true);
    try {
      const res = await productsApi.list({
        search: opts?.search || undefined,
        categoryId: opts?.categoryId || undefined,
      });
      const list = (res.data || []) as Product[];
      setProducts(role === 'cashier' ? list.filter(p => p.isApproved !== false) : list);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'โหลดสินค้าไม่สำเร็จ');
    } finally {
      setIsLoadingProducts(false);
    }
  }, [role]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadCategories();
      void loadProducts();
      searchRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [loadCategories, loadProducts]);

  // ─── Held bills ───────────────────────────────────────────────
  const loadHeldBills = useCallback(async () => {
    try {
      const r = await heldOrdersApi.list();
      setHeldBills((r.data || []) as HeldSummary[]);
    } catch { /* ignore */ }
  }, []);

  // ─── Cart actions ─────────────────────────────────────────────
  const addToCart = async (p: Product) => {
    const low = (p.currentStock ?? 99) <= (p.minStock ?? 0);
    if (low) toast(`⚠ สต็อกต่ำ (${p.currentStock} ชิ้น)`, { icon: '⚠️' });

    const scan = getProductScanMeta(p);
    const ratio = Math.max(1, Math.floor(Number(scan?.ratio || p.conversionFactor || 1) || 1));
    const isPack = scan?.kind === 'pack' && ratio > 1;
    const addQty = isPack ? ratio : 1;

    updateActiveBill(b => {
      const idx = b.cart.findIndex(i => i.id === p.id);
      if (idx >= 0) {
        return {
          ...b,
          cart: b.cart.map((i, ix) => {
            if (ix !== idx) return i;
            const next: CartItem = {
              ...i,
              ratio,
              packPrice: p.wholesalePrice != null ? Number(p.wholesalePrice) : i.packPrice,
              promoQty: p.promoQty != null ? Number(p.promoQty) : i.promoQty,
              promoPrice: p.promoPrice != null ? Number(p.promoPrice) : i.promoPrice,
              discountMode: 'auto',
              unitQty: i.unitQty + (isPack ? 0 : 1),
              packQty: i.packQty + (isPack ? 1 : 0),
              qty: i.qty + addQty,
            };
            return applyAutoPricing(next);
          }),
        };
      }

      const created: CartItem = applyAutoPricing({
        id: p.id,
        nameTh: p.nameTh,
        nameEn: p.nameEn || null,
        retailPrice: Number(p.retailPrice),
        qty: addQty,
        unitQty: isPack ? 0 : 1,
        packQty: isPack ? 1 : 0,
        ratio,
        packPrice: p.wholesalePrice != null ? Number(p.wholesalePrice) : null,
        promoQty: p.promoQty != null ? Number(p.promoQty) : null,
        promoPrice: p.promoPrice != null ? Number(p.promoPrice) : null,
        itemDiscount: 0,
        discountMode: 'auto',
      });
      return { ...b, cart: [...b.cart, created] };
    });

    try {
      const res = await locationsApi.getProductLocations(p.id);
      const first = (res.data as { fullCode: string }[])?.[0]?.fullCode;
      if (first) {
        updateActiveBill(b => ({
          ...b,
          cart: b.cart.map(i => i.id === p.id && !i.pickLocation ? { ...i, pickLocation: first } : i),
        }));
      }
    } catch { /* not critical */ }
  };

  const updateQty = (id: string, delta: number) => {
    updateActiveBill(b => ({
      ...b,
      cart: b.cart.map((i) => {
        if (i.id !== id) return i;
        let unitQty = i.unitQty;
        let packQty = i.packQty;
        let qty = i.qty;
        if (delta > 0) {
          unitQty += delta;
          qty += delta;
        } else if (delta < 0) {
          for (let n = 0; n < Math.abs(delta); n++) {
            if (unitQty > 0) {
              unitQty -= 1;
              qty -= 1;
            } else if (packQty > 0) {
              packQty -= 1;
              qty -= Math.max(1, i.ratio);
            }
          }
        }
        const next = applyAutoPricing({ ...i, unitQty: Math.max(0, unitQty), packQty: Math.max(0, packQty), qty: Math.max(0, qty), discountMode: 'auto' });
        return next;
      }).filter(i => i.qty > 0),
    }));
  };

  const setItemDiscount = (id: string, val: number) => {
    if (val > DISCOUNT_LIMIT && role !== 'owner' && role !== 'manager') {
      setPendingDiscount({ itemId: id, amount: val });
      setShowPassModal(true);
      return;
    }
    applyItemDiscount(id, val);
  };

  const applyItemDiscount = (id: string, val: number) => {
    updateActiveBill(b => ({
      ...b,
      cart: b.cart.map(i => i.id === id ? { ...i, itemDiscount: Math.max(0, val), discountMode: 'manual' } : i),
    }));
  };

  // ─── Manager password verify (server-side) ───────────────────
  const [isVerifyingPass, setIsVerifyingPass] = useState(false);

  const handlePassSubmit = async () => {
    setIsVerifyingPass(true);
    try {
      // Verify role server-side — no password stored in browser
      await authApi.verifyManager();
      if (pendingDiscount?.itemId) applyItemDiscount(pendingDiscount.itemId, pendingDiscount.amount);
      else if (pendingDiscount) {
        updateActiveBill(b => ({ ...b, discount: pendingDiscount.amount }));
      }
      setShowPassModal(false);
      setPendingDiscount(null);
      toast.success('อนุมัติส่วนลดแล้ว');
    } catch {
      toast.error('คุณไม่มีสิทธิ์อนุมัติส่วนลดนี้ — ต้องเป็นผู้จัดการหรือเจ้าของร้าน');
    } finally {
      setIsVerifyingPass(false);
    }
  };

  // ─── Search / barcode ─────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    try {
      const res = await productsApi.byBarcode(q, { mode: 'any' });
      if (res.data) { await addToCart(res.data as Product); setSearch(''); searchRef.current?.focus(); return; }
    } catch { /* ignore */ }
    await loadProducts({ search: q, categoryId: activeCategoryId });
  };

  // ─── Bill tabs ────────────────────────────────────────────────
  const addBill = () => {
    const id = `bill_${Date.now()}`;
    const count = bills.length + 1;
    setBills(prev => [...prev, { ...newBill(id), label: `บิล ${count}` }]);
    setActiveBillId(id);
  };

  const closeBill = (id: string) => {
    if (bills.length === 1) { setBills([{ ...newBill('bill_1'), label: 'บิลใหม่' }]); setActiveBillId('bill_1'); return; }
    const remaining = bills.filter(b => b.id !== id);
    setBills(remaining);
    if (activeBillId === id) setActiveBillId(remaining[0].id);
  };

  // ─── Hold bill ────────────────────────────────────────────────
  const holdCurrentBill = async () => {
    if (cart.length === 0) { toast.error('ตะกร้าว่าง'); return; }
    try {
      await heldOrdersApi.hold({
        label: activeBill.label,
        customerId: customer?.id || undefined,
        customerName: customer?.name || undefined,
        cart: cart.map(i => ({
          productId: i.id,
          productNameTh: i.nameTh,
          unitPrice: i.retailPrice,
          quantity: i.qty,
          itemDiscount: i.itemDiscount,
          pickLocation: i.pickLocation,
        })),
        discount: discountInput,
        note,
      });
      toast.success('พักบิลแล้ว');
      closeBill(activeBillId);
      await loadHeldBills();
    } catch { toast.error('พักบิลไม่สำเร็จ'); }
  };

  const resumeHeldBill = async (id: string) => {
    try {
      const r = await heldOrdersApi.resume(id);
      const held = r.data as {
        id: string;
        label?: string;
        cart: Array<{ productId?: string; productNameTh: string; unitPrice: number; quantity: number; itemDiscount?: number; pickLocation?: string }>;
        customerId?: string;
        customerName?: string;
        discount?: number;
        note?: string;
      };
      let restoredCustomer: Customer | null = null;
      if (held.customerId) {
        try { restoredCustomer = (await customersApi.byId(held.customerId)).data as Customer; } catch { /* ignore */ }
      }
      const newId = `bill_${crypto.randomUUID()}`;
      // Map HeldOrder cart → CartItem shape used by the POS
      const restoredCart: CartItem[] = (held.cart || []).map(i => ({
        id: i.productId || `quick_${crypto.randomUUID()}`,
        nameTh: i.productNameTh,
        retailPrice: Number(i.unitPrice),
        qty: Number(i.quantity),
        unitQty: Number(i.quantity),
        packQty: 0,
        ratio: 1,
        packPrice: null,
        promoQty: null,
        promoPrice: null,
        itemDiscount: Number(i.itemDiscount ?? 0),
        discountMode: (Number(i.itemDiscount ?? 0) > 0) ? 'manual' : 'auto',
        pickLocation: i.pickLocation,
      }));
      const restored: Bill = {
        id: newId,
        label: held.label || 'บิลที่พัก',
        cart: restoredCart,
        customer: restoredCustomer || (held.customerName ? { id: '', name: held.customerName } as Customer : null),
        discount: Number(held.discount ?? 0),
        note: held.note || '',
      };
      setBills(prev => [...prev, restored]);
      setActiveBillId(newId);
      setHeldBills(prev => prev.filter(b => b.id !== id));
      setShowHeldPanel(false);
      toast.success('เรียกบิลคืนแล้ว');
    } catch { toast.error('เรียกบิลไม่สำเร็จ'); }
  };

  const discardHeldBill = async (id: string) => {
    try {
      await heldOrdersApi.discard(id);
      setHeldBills(prev => prev.filter(b => b.id !== id));
    } catch { toast.error('ลบบิลไม่สำเร็จ'); }
  };

  // ─── Opening cash ─────────────────────────────────────────────
  const handleSetOpening = async () => {
    const amt = Number(openingInput);
    if (isNaN(amt) || openingInput.trim() === '') { toast.error('กรุณากรอกจำนวนเงิน'); return; }
    setIsSettingOpening(true);
    try {
      const res = await cashierSessionsApi.open(amt);
      setCashierSession(res.data as CashierSession);
      setShowOpeningModal(false);
      toast.success(`เปิดแคชเชียร์แล้ว — เงินเปิด ${amt.toLocaleString()} ฿`);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string; sessionId?: string; openingAmount?: number; status?: string } } };
      if (e.response?.status === 409) {
        // Session already opened — load it and proceed (idempotent)
        const existing = e.response.data;
        if (existing?.sessionId) {
          const s: CashierSession = {
            id: existing.sessionId,
            date: today,
            openingAmount: existing.openingAmount ?? amt,
            closingAmount: null,
            status: (existing.status as 'open' | 'closed') ?? 'open',
            openedAt: new Date().toISOString(),
            closedAt: null,
          };
          setCashierSession(s);
          setShowOpeningModal(false);
          toast(`วันนี้เปิดแคชเชียร์แล้ว (${Number(s.openingAmount).toLocaleString()} ฿)`, { icon: 'ℹ️' });
        } else {
          toast.error('มีการเปิดแคชเชียร์วันนี้แล้ว');
          setShowOpeningModal(false);
        }
      } else {
        toast.error(e.response?.data?.message || 'บันทึกไม่สำเร็จ');
      }
    } finally {
      setIsSettingOpening(false);
    }
  };

  // ─── Close session (end of day) ──────────────────────────────
  const handleCloseSession = async () => {
    const amt = Number(closingInput);
    if (isNaN(amt) || closingInput.trim() === '') { toast.error('กรุณากรอกยอดเงินปิด'); return; }
    setIsClosingSession(true);
    try {
      const res = await cashierSessionsApi.close(amt);
      setCashierSession(res.data as CashierSession);
      setClosingInput('');
      toast.success(`ปิดแคชเชียร์แล้ว — ยอดปิด ${amt.toLocaleString()} ฿`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ปิดแคชเชียร์ไม่สำเร็จ');
    } finally {
      setIsClosingSession(false);
    }
  };

  // ─── Checkout ─────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('ตะกร้าว่าง'); return; }

    // Block checkout if session is closed
    if (cashierSession && (cashierSession as CashierSession).status === 'closed') {
      toast.error('ปิดแคชเชียร์แล้ว ไม่สามารถรับชำระเงินได้');
      return;
    }

    // Validate discount does not exceed subtotal
    if (discount > subtotal) {
      toast.error(`ส่วนลด (${money(discount)} ฿) เกินยอดรวม (${money(subtotal)} ฿)`);
      return;
    }

    if (paymentMethod === 'cash' && (Number(cashInput) || 0) < netTotal) { toast.error('เงินสดไม่พอ'); return; }
    if ((paymentMethod === 'qr' || paymentMethod === 'transfer') && !slipUrl) { toast.error('ต้องแนบสลิปก่อน'); return; }
    if (isDebt) {
      if (!customer) { toast.error('บิลเชื่อต้องระบุลูกค้า'); return; }
      if (!dueDate) { toast.error('บิลเชื่อต้องระบุวันครบกำหนด'); return; }
      if ((Number(customer.totalDebt) || 0) + netTotal > MAX_DEBT) {
        toast.error(`ลูกค้ามีหนี้เกินวงเงิน ${MAX_DEBT.toLocaleString()} ฿`);
        return;
      }
    }

    setIsCheckout(true);
    try {
      const res = await ordersApi.createPos({
        items: cart.map(i => ({
          productId: i.id,
          productNameTh: i.nameTh,
          productNameEn: i.nameEn || undefined,
          quantity: i.qty,
          unitPrice: i.retailPrice,
          itemDiscount: i.itemDiscount,
        })),
        customerId: customer?.id || undefined,
        customerName: customer?.name || undefined,
        discount,
        vatAmount,
        includeVat,
        paymentMethod,
        isDebt,
        debtAmount: isDebt ? netTotal : 0,
        dueDate: dueDate || undefined,
        slipUrl: slipUrl || undefined,
        note: [note, paymentMethod === 'cash' ? `รับ=${money(Number(cashInput))}/ทอน=${money(change)}` : ''].filter(Boolean).join(' | ') || undefined,
      });

      const created: CreatedOrder = {
        ...(res.data as CreatedOrder),
        total:        netTotal,
        cashReceived: paymentMethod === 'cash' ? Number(cashInput) || 0 : undefined,
        change:       paymentMethod === 'cash' ? change : undefined,
      };

      // Add loyalty points
      if (customer?.id && loyaltyPoints > 0) {
        customersApi.update(customer.id, { loyaltyPoints: (customer.loyaltyPoints || 0) + loyaltyPoints }).catch(() => {});
      }

      toast.success(`ชำระเงินสำเร็จ${loyaltyPoints > 0 ? ` (+${loyaltyPoints} แต้ม)` : ''}`);
      setReceiptOrder(created);
      setIsReceiptOpen(true);

      closeBill(activeBillId);
      setCashInput('');
      setSlipUrl('');
      setIsDebt(false);
      setDueDate('');
      setSearch('');
      searchRef.current?.focus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsCheckout(false);
    }
  };

  // ─── Return order ─────────────────────────────────────────────
  const fetchReturnOrder = async () => {
    const q = returnOrderId.trim();
    if (!q) return;
    setIsFetchingReturn(true);
    try {
      // Try human-readable order number first (POS-YYYYMMDD-xxx)
      // backend GET /orders/by-no/:orderNo handles this
      const r = await ordersApi.byOrderNo(q).catch(() => ordersApi.byId(q));
      setReturnOrder(r.data as CreatedOrder);
    } catch { toast.error('ไม่พบออร์เดอร์ — กรุณาตรวจสอบเลขออร์เดอร์'); }
    finally { setIsFetchingReturn(false); }
  };

  const handleReturn = async () => {
    if (!returnOrder) { toast.error('กรุณาค้นหาออร์เดอร์ก่อน'); return; }
    if (!returnReason.trim()) { toast.error('กรุณากรอกเหตุผลการคืนสินค้า'); return; }
    setIsReturning(true);
    try {
      // Pass order ID (UUID) — backend now accepts both UUID and orderNo
      await ordersApi.returnOrder(String((returnOrder as Record<string, unknown>).id), returnReason);
      toast.success('คืนสินค้าสำเร็จ — stock ถูกคืนแล้ว');
      setShowReturnModal(false);
      setReturnOrder(null);
      setReturnOrderId('');
      setReturnReason('');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsReturning(false);
    }
  };

  // ─── X Report ─────────────────────────────────────────────────
  const loadReport = async (type: 'x' | 'z') => {
    setIsLoadingReport(true);
    setShowReportModal(true);
    try {
      const r = type === 'x' ? await ordersApi.xReport(today) : await ordersApi.zReport(today);
      setReportData(r.data as Record<string, unknown>);
    } catch { toast.error('โหลดรายงานไม่สำเร็จ'); }
    finally { setIsLoadingReport(false); }
  };

  // ─── Receipt text ─────────────────────────────────────────────
  const receiptText = useMemo(() => {
    if (!receiptOrder) return '';
    return buildReceiptText(
      {
        receiptNo: String(receiptOrder.orderNo || '—'),
        issuedAt: receiptOrder.paidAt ? new Date(String(receiptOrder.paidAt)) : new Date(),
        cashierName,
        items: (receiptOrder.items || []).map(i => ({
          name: String(i.productNameEn || i.productNameTh || ''),
          qty: Number(i.quantity || 0),
          price: Number(i.unitPrice || 0),
        })),
        discount: Number(receiptOrder.discount) || 0,
        vatRate: includeVat ? 0.07 : 0,
        total: receiptOrder.total,
        payment: {
          methodLabel: paymentMethodLabel(String(receiptOrder.paymentMethod || '')),
          received: receiptOrder.cashReceived,
          change: receiptOrder.change,
        },
      },
      { charsPerLine: 48, store: { headerLines: receiptHeaderLines, footerLines: receiptFooterLines } },
    );
  }, [receiptOrder, cashierName, includeVat, receiptHeaderLines, receiptFooterLines]);

  // ─── Opening cash gate ────────────────────────────────────────
  if (cashierSession === null && !showOpeningModal) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="h-full bg-gray-50">

      {/* Opening cash modal */}
      {showOpeningModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Banknote size={20} className="text-orange-500" />
              <h2 className="text-lg font-bold">ตั้งเงินเปิดแคชเชียร์</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">กรอกยอดเงินเริ่มต้นในลิ้นชักก่อนเปิดขาย</p>
            <input
              type="number"
              autoFocus
              value={openingInput}
              onChange={e => setOpeningInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetOpening()}
              placeholder="เช่น 500"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-center outline-none focus:border-orange-400 mb-4"
            />
            <div className="flex gap-2 flex-wrap mb-4">
              {[500, 1000, 2000, 5000].map(v => (
                <button key={v} onClick={() => setOpeningInput(String(v))}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-orange-50 hover:border-orange-300">
                  {v.toLocaleString()}
                </button>
              ))}
            </div>
            <button
              onClick={handleSetOpening}
              disabled={isSettingOpening}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSettingOpening ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              ยืนยัน
            </button>
          </div>
        </div>
      )}

      {/* Manager approval modal — role verified server-side, no password stored in browser */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={18} className="text-gray-500" />
              <h3 className="font-bold">ส่วนลดเกิน {DISCOUNT_LIMIT} ฿</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              ต้องได้รับการอนุมัติจากผู้จัดการหรือเจ้าของร้าน<br />
              กรุณาให้ผู้จัดการ <span className="font-semibold">ล็อกอินบัญชีตัวเองและกดยืนยัน</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePassSubmit}
                disabled={isVerifyingPass}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                {isVerifyingPass ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                ยืนยัน (ด้วยสิทธิ์ปัจจุบัน)
              </button>
              <button onClick={() => { setShowPassModal(false); setPendingDiscount(null); }}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Return modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold"><RotateCcw size={16} className="text-red-500" /> คืนสินค้า / Refund</div>
              <button onClick={() => { setShowReturnModal(false); setReturnOrder(null); setReturnOrderId(''); setReturnReason(''); }}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input value={returnOrderId} onChange={e => setReturnOrderId(e.target.value)}
                  placeholder="เลขออร์เดอร์ หรือ Order ID"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <button onClick={fetchReturnOrder} disabled={isFetchingReturn}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm disabled:opacity-50">
                  {isFetchingReturn ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </div>
              {returnOrder && (
                <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="text-sm font-semibold">#{(returnOrder as Record<string,unknown>).orderNo as string}</div>
                  <div className="space-y-1">
                    {((returnOrder as Record<string,unknown>).items as { productNameTh: string; quantity: number; unitPrice: number }[] || []).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-600">
                        <span>{item.productNameTh} × {item.quantity}</span>
                        <span>{(item.unitPrice * item.quantity).toLocaleString()} ฿</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <input value={returnReason} onChange={e => setReturnReason(e.target.value)}
                      placeholder="เหตุผลในการคืน *"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <button onClick={handleReturn} disabled={isReturning}
                    className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {isReturning ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    ยืนยันคืนสินค้า (คืน stock อัตโนมัติ)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* X/Z Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold"><BarChart2 size={16} className="text-orange-500" /> รายงานประจำวัน</div>
              <button onClick={() => setShowReportModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
            </div>
            <div className="p-4">
              {isLoadingReport ? (
                <div className="h-32 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
              ) : reportData ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-500">เปิดแคชเชียร์</div>
                      <div className="font-bold text-lg">{Number(reportData.openingCash || 0).toLocaleString()} ฿</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-500">ยอดรวม</div>
                      <div className="font-bold text-lg text-orange-600">{Number(reportData.totalRevenue || 0).toLocaleString()} ฿</div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">แยกตามวิธีชำระ</div>
                  {Object.entries((reportData.byMethod as Record<string, number>) || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm border-b border-gray-100 pb-1">
                      <span className="text-gray-600 capitalize">{paymentMethodLabel(k)}</span>
                      <span className="font-semibold">{Number(v).toLocaleString()} ฿</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-1">
                    <span>บิลทั้งหมด</span>
                    <span>{Number(reportData.totalOrders || 0)} บิล</span>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-2 mt-4">
                <button onClick={() => loadReport('x')} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">X-Report</button>
                <button onClick={() => loadReport('z')} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">Z-Report</button>
              </div>

              {/* Close Cash (end of day) */}
              {cashierSession && cashierSession.status === 'open' && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">ปิดแคชเชียร์ (สิ้นวัน)</div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={closingInput}
                      onChange={e => setClosingInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCloseSession()}
                      placeholder="ยอดเงินในลิ้นชัก"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"
                    />
                    <button
                      onClick={handleCloseSession}
                      disabled={isClosingSession}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-950 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5"
                    >
                      {isClosingSession ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                      ปิดวัน
                    </button>
                  </div>
                </div>
              )}
              {cashierSession && cashierSession.status === 'closed' && (
                <div className="mt-4 border-t border-gray-100 pt-3 text-center text-sm text-gray-400">
                  🔒 ปิดแคชเชียร์แล้ว — ยอดปิด {Number(cashierSession.closingAmount ?? 0).toLocaleString()} ฿
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Held bills panel */}
      {showHeldPanel && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowHeldPanel(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh]">

            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <PauseCircle size={16} className="text-amber-500" />
                <span className="font-bold text-sm">บิลที่พักไว้</span>
                {heldBills.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {heldBills.length}
                  </span>
                )}
              </div>
              <button onClick={() => setShowHeldPanel(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
              {heldBills.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                  <PauseCircle size={28} className="text-gray-200" />
                  ไม่มีบิลที่พักไว้
                </div>
              ) : heldBills.map(b => (
                <div key={b.id}
                  className="border border-gray-200 rounded-2xl overflow-hidden hover:border-amber-300 transition group">
                  {/* Resume button area */}
                  <button
                    onClick={() => resumeHeldBill(b.id)}
                    className="w-full text-left px-3 pt-3 pb-2 hover:bg-amber-50 transition">
                    <div className="flex items-start gap-2">
                      <PlayCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{b.label}</div>
                        {b.customerName && (
                          <div className="text-xs text-blue-500 truncate mt-0.5">{b.customerName}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{b.totalQty} ชิ้น ({b.itemCount} รายการ)</span>
                          {b.discount > 0 && <span className="text-red-400">ลด {b.discount.toLocaleString()} ฿</span>}
                          <span className="ml-auto">
                            {new Date(b.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                  {/* Discard button */}
                  <div className="px-3 pb-2 flex justify-end">
                    <button
                      onClick={() => discardHeldBill(b.id)}
                      className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50">
                      <X size={11} /> ลบบิล
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            {heldBills.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400 text-center shrink-0">
                แตะเพื่อเรียกบิลคืน · บิลที่พักจะถูกบันทึกในฐานข้อมูล
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {isReceiptOpen && receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold">ใบเสร็จ #{receiptOrder.orderNo}</div>
              <button onClick={() => setIsReceiptOpen(false)} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto bg-gray-50">
              <ReceiptPrint text={receiptText} widthMm={58} qrImageUrl={STORE_INFO.qrImageUrl} />
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                disabled={isPrinting}
                onClick={async () => {
                  if (!receiptOrder) return;
                  const isCash = receiptOrder.paymentMethod === 'cash' || paymentMethod === 'cash';
                  setIsPrinting(true);
                  try {
                    await printReceipt(
                      {
                        shopName:    STORE_INFO.name,
                        address:     `${STORE_INFO.tagline} ${STORE_INFO.address}`,
                        tel:         STORE_INFO.phone,
                        receiptNo:   String(receiptOrder.orderNo || '—'),
                        issuedAt:    receiptOrder.paidAt ? new Date(String(receiptOrder.paidAt)) : new Date(),
                        cashierName,
                        items: (receiptOrder.items || []).map(i => ({
                          name:  String(i.productNameEn || i.productNameTh || ''),
                          qty:   Number(i.quantity  || 0),
                          price: Number(i.unitPrice  || 0),
                        })),
                        total:  receiptOrder.total  ?? 0,
                        cash:   receiptOrder.cashReceived,
                        change: receiptOrder.change,
                        footerLines: receiptFooterLines,
                        openDrawer:  isCash,
                      },
                      {
                        host:    printerSettings?.printerIp  || '192.168.1.121',
                        port:    printerSettings?.printerPort || 9100,
                      },
                    );
                    toast.success('พิมพ์ใบเสร็จสำเร็จ');
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'พิมพ์ไม่สำเร็จ');
                  } finally {
                    setIsPrinting(false);
                  }
                }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {isPrinting ? <Loader2 size={14} className="animate-spin" /> : null}
                พิมพ์
              </button>
              <button onClick={() => setIsReceiptOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 p-4">

        {/* ── Catalog ─────────────────────────────────────────────── */}
        <section className="min-w-0 flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-gray-800 shrink-0">
                <Receipt size={18} className="text-orange-500" />
                <span className="font-bold text-sm">POS</span>
                {cashierSession && (
                  <span className={`text-xs font-normal ${cashierSession.status === 'closed' ? 'text-red-400' : 'text-gray-400'}`}>
                    {cashierSession.status === 'closed' ? '🔒 ปิดวันแล้ว' : `เปิด ${Number(cashierSession.openingAmount).toLocaleString()} ฿`}
                  </span>
                )}
              </div>
              <form onSubmit={handleSearch} className="flex-1 min-w-0">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="ค้นหา / Barcode..." className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
              </form>
              <button onClick={() => { setSearch(''); loadProducts({ search: '', categoryId: activeCategoryId }); searchRef.current?.focus(); }}
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600"><X size={15} /></button>
              {/* Toolbar */}
              <button onClick={() => { loadHeldBills(); setShowHeldPanel(true); }} title="บิลที่พัก"
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-amber-100 rounded-xl text-gray-600 hover:text-amber-600 relative">
                <PauseCircle size={15} />
                {heldBills.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center">{heldBills.length}</span>}
              </button>
              <button onClick={() => setShowReturnModal(true)} title="คืนสินค้า"
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-red-50 rounded-xl text-gray-600 hover:text-red-500"><RotateCcw size={15} /></button>
              {(role === 'owner' || role === 'manager') && (
                <button onClick={() => loadReport('x')} title="รายงาน"
                  className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-orange-50 rounded-xl text-gray-600 hover:text-orange-500"><BarChart2 size={15} /></button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button onClick={() => { setActiveCategoryId(''); loadProducts({ search, categoryId: '' }); }}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-sm border transition ${activeCategoryId === '' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}>
                <span className="flex items-center gap-1.5"><Tag size={13} /> ทั้งหมด</span>
              </button>
              {categories.map(c => (
                <button key={c.id}
                  onClick={() => { setActiveCategoryId(c.id); loadProducts({ search, categoryId: c.id }); }}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-sm border transition ${activeCategoryId === c.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}>
                  <span className="flex items-center gap-1">{c.icon && <span>{c.icon}</span>}{c.nameTh}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Products grid */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex-1 min-h-0 overflow-y-auto">
            {isLoadingProducts ? (
              <div className="h-48 flex items-center justify-center text-gray-400"><Loader2 size={18} className="animate-spin" /><span className="ml-2 text-sm">กำลังโหลด...</span></div>
            ) : products.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ไม่พบสินค้า</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {products.map(p => {
                  const isLow = p.currentStock != null && p.currentStock <= (p.minStock ?? 0);
                  return (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="group text-left border border-gray-200 rounded-2xl overflow-hidden hover:border-orange-300 hover:shadow-sm transition bg-white relative">
                      {isLow && (
                        <span className="absolute top-2 left-2 z-10 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle size={10} /> ต่ำ
                        </span>
                      )}
                      <div className="aspect-4/3 bg-gray-50 overflow-hidden">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={String(p.imageUrl)} alt={p.nameTh}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-200"><Receipt size={28} /></div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="font-semibold text-gray-900 text-sm line-clamp-2">{p.nameTh}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <div className="text-orange-600 font-bold text-sm">{Number(p.retailPrice || 0).toLocaleString()} ฿</div>
                          <div className="w-7 h-7 rounded-xl bg-orange-500 text-white flex items-center justify-center group-hover:bg-orange-600 transition"><Plus size={14} /></div>
                        </div>
                        {p.currentStock != null && (
                          <div className={`text-[11px] mt-0.5 ${isLow ? 'text-amber-500 font-semibold' : 'text-gray-400'}`}>
                            คงเหลือ {Number(p.currentStock)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Cart ────────────────────────────────────────────────── */}
        <aside className="bg-white border border-gray-200 rounded-2xl flex flex-col min-h-0">
          {/* Bill tabs */}
          <div className="px-3 pt-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {bills.map(b => (
              <div key={b.id} className="flex items-center shrink-0">
                <button onClick={() => setActiveBillId(b.id)}
                  className={`px-3 py-1.5 rounded-t-xl text-xs font-semibold transition ${b.id === activeBillId ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {b.label}
                  {b.cart.length > 0 && <span className="ml-1 opacity-70">({b.cart.length})</span>}
                </button>
                {bills.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); closeBill(b.id); }}
                    className="ml-0.5 text-gray-400 hover:text-red-500"><X size={11} /></button>
                )}
              </div>
            ))}
            <button onClick={addBill} className="shrink-0 w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-orange-50 rounded-xl text-gray-500 hover:text-orange-500 ml-1">
              <Plus size={14} />
            </button>
          </div>

          {/* Cart header */}
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {cart.reduce((s, i) => s + i.qty, 0)} ชิ้น / {cart.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <button onClick={holdCurrentBill} title="พักบิล"
                className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 rounded-lg text-amber-600 flex items-center gap-1 disabled:opacity-40"
                disabled={cart.length === 0}>
                <PauseCircle size={12} /> พัก
              </button>
              <button onClick={() => { if (cart.length > 0 && confirm('ล้างสินค้าในบิลนี้ทั้งหมด?')) updateActiveBill(b => ({ ...b, cart: [] })); }} disabled={cart.length === 0}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 disabled:opacity-40">ล้าง</button>
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีสินค้า</div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="border border-gray-200 rounded-2xl p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{item.nameTh}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {Number(item.retailPrice).toLocaleString()} ฿/ชิ้น
                        {item.packQty > 0 && item.ratio > 1 && (
                          <span className="ml-2 text-orange-500">
                            • แพ็ค x{item.packQty} ({money(item.packPrice ?? (item.retailPrice * item.ratio))} ฿/แพ็ค)
                          </span>
                        )}
                        {item.promoQty && item.promoPrice && item.promoQty > 1 && item.promoPrice > 0 && (
                          <span className="ml-2 text-emerald-600">
                            • โปรฯ {item.promoQty} ชิ้น={money(item.promoPrice)} ฿
                          </span>
                        )}
                        {item.pickLocation && <span className="ml-2 font-mono text-blue-400">• {item.pickLocation}</span>}
                      </div>
                    </div>
                    <button onClick={() => updateActiveBill(b => ({ ...b, cart: b.cart.filter(i => i.id !== item.id) }))}
                      className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center"><Minus size={12} /></button>
                      <span className="w-8 text-center font-bold text-sm">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center"><Plus size={12} /></button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">ลด</span>
                      <input type="number" min={0} value={item.itemDiscount || ''}
                        onChange={e => setItemDiscount(item.id, Number(e.target.value))}
                        placeholder="0"
                        className="w-16 text-right border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-orange-400" />
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.discountMode === 'auto' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>
                        {item.discountMode === 'auto' ? 'AUTO' : 'MANUAL'}
                      </span>
                    </div>
                    <div className="font-bold text-gray-900 text-sm tabular-nums">
                      {((item.retailPrice * item.qty) - item.itemDiscount).toLocaleString()} ฿
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Customer + note */}
            <div className="border border-gray-200 rounded-2xl p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><User size={11} /> ลูกค้า</div>
              <CustomerDropdown
                value={customer}
                onChange={c => updateActiveBill(b => ({ ...b, customer: c }))}
              />
              {customer && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 space-y-0.5">
                  {customer.loyaltyPoints != null && <div>แต้มสะสม: <span className="font-semibold text-orange-600">{customer.loyaltyPoints}</span></div>}
                  {(customer.totalDebt || 0) > 0 && <div className={`font-semibold ${Number(customer.totalDebt) >= MAX_DEBT ? 'text-red-600' : 'text-amber-600'}`}>หนี้คงค้าง: {Number(customer.totalDebt).toLocaleString()} ฿</div>}
                </div>
              )}
              <textarea value={note} onChange={e => updateActiveBill(b => ({ ...b, note: e.target.value }))}
                placeholder="หมายเหตุ" rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none" />
            </div>
          </div>

          {/* Totals + payment */}
          <div className="p-3 border-t border-gray-100 space-y-3">
            {/* Summary */}
            <div className="border border-gray-200 rounded-2xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">รวม</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">ส่วนลดบิล</span>
                <input type="number" min={0} value={discountInput}
                  onChange={e => updateActiveBill(b => ({ ...b, discount: Number(e.target.value) }))}
                  className="w-24 text-right border border-gray-200 rounded-xl px-2 py-1 text-sm outline-none focus:border-orange-400 tabular-nums" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-gray-500 flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} className="rounded" />
                  ภาษีมูลค่าเพิ่ม 7%
                </label>
                <span className="tabular-nums text-gray-500">{includeVat ? money(vatAmount) : '—'}</span>
              </div>
              <div className="pt-1.5 border-t border-gray-100 flex justify-between font-bold">
                <span>ยอดสุทธิ</span>
                <span className="text-orange-600 text-base tabular-nums">{money(netTotal)}</span>
              </div>
              {loyaltyPoints > 0 && customer && (
                <div className="text-xs text-emerald-600">+{loyaltyPoints} แต้มสะสม</div>
              )}
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['cash', 'qr', 'transfer', 'cod'] as PaymentMethodType[]).map(pm => (
                <button key={pm} onClick={() => setPaymentMethod(pm)}
                  className={`py-2 rounded-xl border text-xs font-semibold transition flex flex-col items-center gap-0.5 ${paymentMethod === pm ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}>
                  {pm === 'cash' && <Banknote size={14} />}
                  {pm === 'qr' && <QrCode size={14} />}
                  {pm === 'transfer' && <CreditCard size={14} />}
                  {pm === 'cod' && <Receipt size={14} />}
                  {paymentMethodLabel(pm)}
                </button>
              ))}
            </div>

            {/* Cash input + quick buttons */}
            {paymentMethod === 'cash' && (
              <div className="border border-gray-200 rounded-2xl p-3 space-y-2">
                <div className="flex gap-1.5 flex-wrap">
                  {[50, 100, 500, 1000].map(v => (
                    <button key={v} onClick={() => setCashInput(String(v))}
                      className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs hover:bg-orange-50 hover:border-orange-300 font-medium">
                      {v}
                    </button>
                  ))}
                  <button onClick={() => setCashInput(money(netTotal))}
                    className="px-2.5 py-1.5 border border-orange-200 rounded-xl text-xs bg-orange-50 text-orange-600 font-medium">พอดี</button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">รับเงิน</span>
                  <input value={cashInput} onChange={e => setCashInput(e.target.value)} type="number" min={0} placeholder="0.00"
                    className="w-28 text-right border border-gray-200 rounded-xl px-2 py-1.5 text-sm outline-none focus:border-orange-400 tabular-nums" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">เงินทอน</span>
                  <span className={`font-bold tabular-nums ${change > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{money(change)}</span>
                </div>
              </div>
            )}

            {/* Slip upload for QR/transfer */}
            {(paymentMethod === 'qr' || paymentMethod === 'transfer') && (
              <SlipUpload value={slipUrl} onChange={setSlipUrl} required />
            )}

            {/* Debt toggle */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDebt" checked={isDebt} onChange={e => setIsDebt(e.target.checked)} className="rounded" />
              <label htmlFor="isDebt" className="text-sm text-gray-600 cursor-pointer">บิลเชื่อ (ลูกค้าจ่ายภายหลัง)</label>
            </div>
            {isDebt && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
                <div className="text-xs font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> บิลเชื่อ — ต้องระบุลูกค้าและวันครบกำหนด</div>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  min={today}
                  className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white" />
              </div>
            )}

            {/* Checkout button — disabled when session is closed */}
            {cashierSession && (cashierSession as CashierSession).status === 'closed' ? (
              <div className="w-full py-3 bg-gray-200 text-gray-400 font-bold rounded-2xl text-sm text-center">
                🔒 ปิดแคชเชียร์แล้ว — ไม่รับชำระเงิน
              </div>
            ) : (
              <button onClick={handleCheckout} disabled={cart.length === 0 || isCheckout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-950 disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm transition">
                {isCheckout ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                บันทึก + ชำระเงิน
              </button>
            )}

            {/* Reprint */}
            {receiptOrder && (
              <button onClick={() => setIsReceiptOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-2xl text-sm">
                <Receipt size={14} /> พิมพ์ใบเสร็จซ้ำ
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
