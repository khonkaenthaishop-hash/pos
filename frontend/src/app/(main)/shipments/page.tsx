'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { gmailShippingApi, ordersApi } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type EmailType =
  | 'created'
  | 'shipped'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'warning'
  | 'returned';

interface ShippingDashboardItem {
  emailId: string;
  orderId: string;
  orderNo: string;
  customerName: string;
  emailType: EmailType;
  currentStatus: string;
  cNumber: string | null;
  posTotal: number;
  emailTotal: number | null;
  amountMismatch: { emailTotal: number; posTotal: number; diff: number } | null;
  adminConfirmed: boolean;
  receivedAt: string;
  paymentMethod: string | null;
  deliveryMethod: string | null;
}

interface UnmatchedEmail {
  id: string;
  subject: string;
  receivedAt: string;
  totalAmount: number | null;
  senderEmail: string;
}

interface OrderOption {
  id: string;
  orderNo: string;
  customerName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** แปลงวันที่เป็น Buddhist Era: DD/MM/YY */
function toBuddhistDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear() + 543).slice(-2);
  return `${day}/${month}/${year}`;
}

/** แปลง Date เป็น YYYY-MM-DD สำหรับส่ง API */
function toApiDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format ยอดเงิน NT$xxx */
function formatNTD(amount: number | null): string {
  if (amount === null) return '-';
  return Number.isInteger(amount) ? `NT$${amount}` : `NT$${amount.toFixed(0)}`;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EmailType,
  { label: string; className: string }
> = {
  arrived:   { label: 'ถึง 7-11 แล้ว',  className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'ลูกค้ารับแล้ว', className: 'bg-green-100 text-green-700' },
  warning:   { label: 'ยังไม่รับ',      className: 'bg-yellow-100 text-yellow-700' },
  returned:  { label: 'คืนสินค้า',      className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'ยกเลิก',         className: 'bg-gray-100 text-gray-500' },
  shipped:   { label: 'ส่งแล้ว',        className: 'bg-purple-100 text-purple-700' },
  created:   { label: 'สร้างแล้ว',      className: 'bg-slate-100 text-slate-600' },
};

function StatusBadge({ type }: { type: EmailType }) {
  const cfg = STATUS_CONFIG[type] ?? { label: type, className: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`คัดลอก ${text} แล้ว`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="คัดลอก C Number"
      className={`ml-1.5 p-1 rounded transition-colors ${
        copied
          ? 'text-green-600 bg-green-50'
          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function MismatchTooltip({ diff }: { diff: number }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-red-500 ml-1">⚠️</span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 w-max max-w-xs bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg pointer-events-none">
          ยอดต่างกัน {diff > 0 ? '+' : ''}{formatNTD(diff)}
        </span>
      )}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-4 border-b border-slate-100">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-slate-200 rounded w-32" />
            <div className="h-3 bg-slate-100 rounded w-20" />
          </div>
          <div className="h-3.5 bg-slate-200 rounded w-28 self-center" />
          <div className="h-5 bg-slate-200 rounded-full w-20 self-center" />
          <div className="h-3.5 bg-slate-200 rounded w-16 self-center" />
          <div className="h-3.5 bg-slate-200 rounded w-16 self-center" />
          <div className="h-7 bg-slate-200 rounded-lg w-16 self-center" />
        </div>
      ))}
    </div>
  );
}

// ─── Match Modal ──────────────────────────────────────────────────────────────

function MatchOrderModal({
  emailId,
  subject,
  onClose,
  onMatched,
}: {
  emailId: string;
  subject: string;
  onClose: () => void;
  onMatched: () => void;
}) {
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchOrders = useCallback(async (q: string) => {
    if (!q.trim()) { setOrders([]); return; }
    setIsSearching(true);
    try {
      const res = await ordersApi.list({ search: q, limit: 10 });
      const data = (res.data as { data?: OrderOption[]; items?: OrderOption[] } | OrderOption[]);
      const items: OrderOption[] = Array.isArray(data)
        ? data
        : (data as { data?: OrderOption[]; items?: OrderOption[] }).data
          ?? (data as { items?: OrderOption[] }).items
          ?? [];
      setOrders(items);
    } catch {
      setOrders([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchOrders(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, searchOrders]);

  const handleMatch = async (orderId: string) => {
    setIsMatching(true);
    try {
      await gmailShippingApi.matchEmail(emailId, orderId);
      toast.success('Match สำเร็จ');
      onMatched();
    } catch {
      toast.error('Match ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="text-sm font-bold text-gray-900">Match กับ Order</div>
            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{subject}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาเลขออเดอร์หรือชื่อลูกค้า..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
          />

          {isSearching && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 size={13} className="animate-spin" /> กำลังค้นหา...
            </div>
          )}

          {!isSearching && orders.length === 0 && search.trim() !== '' && (
            <div className="text-xs text-gray-400 py-2 text-center">ไม่พบออเดอร์</div>
          )}

          <div className="space-y-1 max-h-52 overflow-y-auto">
            {orders.map(o => (
              <button
                key={o.id}
                disabled={isMatching}
                onClick={() => handleMatch(o.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-orange-50 text-left transition-colors disabled:opacity-60"
              >
                <div>
                  <div className="text-sm font-medium text-gray-800">{o.orderNo}</div>
                  {o.customerName && (
                    <div className="text-xs text-gray-400">{o.customerName}</div>
                  )}
                </div>
                {isMatching && <Loader2 size={13} className="animate-spin text-orange-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShipmentsPage() {
  const [date, setDate] = useState<Date>(new Date());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [matchFilter, setMatchFilter] = useState<string>('all');

  const [items, setItems] = useState<ShippingDashboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [unmatchedEmails, setUnmatchedEmails] = useState<UnmatchedEmail[]>([]);
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);
  const [isLoadingUnmatched, setIsLoadingUnmatched] = useState(false);

  const [matchModal, setMatchModal] = useState<{ emailId: string; subject: string } | null>(null);

  // ── Fetch dashboard ──
  const fetchDashboard = useCallback(async (d: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await gmailShippingApi.dashboard(toApiDate(d));
      setItems((res.data as ShippingDashboardItem[]) ?? []);
    } catch {
      setError('ไม่สามารถดึงข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Fetch unmatched ──
  const fetchUnmatched = useCallback(async () => {
    setIsLoadingUnmatched(true);
    try {
      const res = await gmailShippingApi.unmatched();
      setUnmatchedEmails((res.data as UnmatchedEmail[]) ?? []);
    } catch {
      setUnmatchedEmails([]);
    } finally {
      setIsLoadingUnmatched(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(date);
    fetchUnmatched();
  }, [date, fetchDashboard, fetchUnmatched]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboard(date);
      fetchUnmatched();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [date, fetchDashboard, fetchUnmatched]);

  // ── Sync ──
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await gmailShippingApi.sync();
      const { processed, matched, errors } = res.data as {
        processed: number;
        matched: number;
        errors: number;
      };
      toast.success(`Sync สำเร็จ: ${processed} emails, ${matched} matched, ${errors} errors`);
      fetchDashboard(date);
      fetchUnmatched();
    } catch {
      toast.error('Sync ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Confirm ──
  const handleConfirm = async (emailId: string) => {
    setConfirmingId(emailId);
    try {
      await gmailShippingApi.confirmEmail(emailId);
      toast.success('ยืนยันแล้ว');
      setItems(prev =>
        prev.map(item =>
          item.emailId === emailId ? { ...item, adminConfirmed: true } : item,
        ),
      );
    } catch {
      toast.error('ยืนยันไม่สำเร็จ');
    } finally {
      setConfirmingId(null);
    }
  };

  // ── Date input value ──
  const dateInputValue = toApiDate(date);

  // ── Filtered items ──
  const filtered = items.filter(item => {
    if (typeFilter !== 'all' && item.emailType !== typeFilter) return false;
    if (matchFilter === 'matched' && !item.orderId) return false;
    if (matchFilter === 'unmatched' && item.orderId) return false;
    if (matchFilter === 'mismatch' && !item.amountMismatch) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <Truck size={16} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">ติดตามการจัดส่ง</h1>
              <p className="text-xs text-gray-400">ข้อมูลจาก Gmail 7-11 อัตโนมัติ</p>
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition"
          >
            {isSyncing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Sync ตอนนี้
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {/* Date picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">วันที่:</label>
            <div className="relative">
              <input
                type="date"
                value={dateInputValue}
                onChange={e => {
                  const v = e.target.value;
                  if (v) setDate(new Date(v + 'T00:00:00'));
                }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-orange-400"
              />
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                พ.ศ.&nbsp;{date.getFullYear() + 543}
              </div>
            </div>
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-orange-400 bg-white"
          >
            <option value="all">ทุกประเภท</option>
            <option value="arrived">ถึง 7-11 แล้ว</option>
            <option value="completed">ลูกค้ารับแล้ว</option>
            <option value="warning">ยังไม่รับ</option>
            <option value="returned">คืนสินค้า</option>
            <option value="cancelled">ยกเลิก</option>
            <option value="shipped">ส่งแล้ว</option>
            <option value="created">สร้างแล้ว</option>
          </select>

          {/* Match status filter */}
          <select
            value={matchFilter}
            onChange={e => setMatchFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-orange-400 bg-white"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
            <option value="mismatch">ยอดไม่ตรง</option>
          </select>

          <span className="text-xs text-slate-400 ml-auto">
            {toBuddhistDate(date)} ({filtered.length} รายการ)
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Main table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {error ? (
            <div className="py-16 text-center text-sm text-red-500">{error}</div>
          ) : isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Truck size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">ไม่มีข้อมูลการจัดส่งในวันนี้</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    ออเดอร์
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    C Number
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    สถานะ
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    ยอด POS
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    ยอด 7-11
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                    ยืนยัน
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr
                    key={item.emailId}
                    className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* ออเดอร์ */}
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800 text-sm">
                        {item.orderNo || '—'}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {item.customerName || '—'}
                      </div>
                    </td>

                    {/* C Number */}
                    <td className="px-4 py-3.5">
                      {item.cNumber ? (
                        <div className="flex items-center">
                          <span className="font-mono text-sm text-slate-700">
                            {item.cNumber}
                          </span>
                          <CopyButton text={item.cNumber} />
                        </div>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>

                    {/* สถานะ */}
                    <td className="px-4 py-3.5">
                      <StatusBadge type={item.emailType} />
                    </td>

                    {/* ยอด POS */}
                    <td className="px-4 py-3.5 text-right font-medium text-slate-700 text-sm">
                      {formatNTD(item.posTotal)}
                    </td>

                    {/* ยอด 7-11 */}
                    <td className="px-4 py-3.5 text-right text-sm">
                      <span className={item.amountMismatch ? 'text-red-600 font-medium' : 'text-slate-700'}>
                        {formatNTD(item.emailTotal)}
                      </span>
                      {item.amountMismatch && (
                        <MismatchTooltip diff={item.amountMismatch.diff} />
                      )}
                    </td>

                    {/* ยืนยัน */}
                    <td className="px-4 py-3.5 text-center">
                      {item.adminConfirmed ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold">
                          <CheckCircle size={14} />
                          ยืนยันแล้ว
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirm(item.emailId)}
                          disabled={confirmingId === item.emailId}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                        >
                          {confirmingId === item.emailId ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            'ยืนยัน'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Unmatched Emails panel */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setUnmatchedOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Emails ที่ยังไม่ได้ Match
              </span>
              {unmatchedEmails.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unmatchedEmails.length}
                </span>
              )}
            </div>
            {unmatchedOpen ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>

          {unmatchedOpen && (
            <div className="border-t border-slate-100">
              {isLoadingUnmatched ? (
                <div className="flex items-center gap-2 px-5 py-4 text-xs text-slate-400">
                  <Loader2 size={13} className="animate-spin" /> กำลังโหลด...
                </div>
              ) : unmatchedEmails.length === 0 ? (
                <div className="px-5 py-4 text-sm text-slate-400 text-center">
                  ไม่มี email ที่รอ match
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Subject
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">
                        วันที่รับ
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                        ยอดใน Email
                      </th>
                      <th className="px-4 py-3 w-36" />
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedEmails.map(email => (
                      <tr
                        key={email.id}
                        className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-3 text-slate-700 truncate max-w-xs">
                          {email.subject}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {toBuddhistDate(email.receivedAt)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatNTD(email.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              setMatchModal({ emailId: email.id, subject: email.subject })
                            }
                            className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Match กับ Order
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Match modal */}
      {matchModal && (
        <MatchOrderModal
          emailId={matchModal.emailId}
          subject={matchModal.subject}
          onClose={() => setMatchModal(null)}
          onMatched={() => {
            setMatchModal(null);
            fetchDashboard(date);
            fetchUnmatched();
          }}
        />
      )}
    </div>
  );
}
