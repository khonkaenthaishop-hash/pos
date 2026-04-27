'use client';
import { useState, useEffect, useRef } from 'react';
import { inventoryApi, productsApi } from '@/lib/api';
import { getProductScanMeta } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Trash2, ScanLine, Search, Loader2, BarChart3, CalendarDays } from 'lucide-react';

type Product = Record<string, unknown>;
type ReasonCode = { code: string; label: string };

type DiscardLine = {
  product: Product;
  quantity: number;
  unit: string;
  reasonCode: string;
  notes: string;
  scannedBarcode?: string;
  scanKind?: 'unit' | 'pack';
  scanRatio?: number;
};

type SummaryRow = { label: string; count: number; totalQty: number; totalCost: number };

export default function DiscardPage() {
  const [tab, setTab] = useState<'discard' | 'report'>('discard');
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lines, setLines] = useState<DiscardLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Report state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<{ byReason: Record<string, SummaryRow>; totalItems: number } | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    inventoryApi.reasonCodes('OUT').then(r => setReasonCodes(r.data || []));
    barcodeRef.current?.focus();
  }, []);

  const defaultReason = reasonCodes[0]?.code || 'DAMAGED';

  // ── Scan ─────────────────────────────────────────────────────────
  const handleScan = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      const scanned = barcodeInput.trim();
      const res = await productsApi.byBarcode(scanned, { mode: 'inventory' });
      const product = res.data;
      if (!product) { toast.error('ไม่พบสินค้า'); return; }
      const scan = getProductScanMeta(product);
      setLines(prev => [...prev, {
        product,
        quantity: 1,
        unit: scan?.kind === 'pack'
          ? String((product as Record<string, unknown>).wholesaleUnit || (product as Record<string, unknown>).unit || 'ชิ้น')
          : String((product as Record<string, unknown>).unit || 'ชิ้น'),
        reasonCode: defaultReason,
        notes: '',
        scannedBarcode: scanned,
        scanKind: scan?.kind === 'pack' ? 'pack' : 'unit',
        scanRatio: Number(scan?.ratio || 1),
      }]);
      setBarcodeInput('');
      barcodeRef.current?.focus();
    } catch { toast.error('ไม่พบสินค้าจากบาร์โค้ดนี้'); }
  };

  const handleSearch = async () => {
    if (!barcodeInput.trim()) return;
    try {
      const res = await productsApi.list({ search: barcodeInput.trim() });
      const list = res.data || [];
      if (list.length === 1) {
        setLines(prev => [...prev, {
          product: list[0],
          quantity: 1,
          unit: String(list[0].unit || 'ชิ้น'),
          reasonCode: defaultReason,
          notes: '',
        }]);
        setBarcodeInput('');
      } else if (list.length === 0) {
        toast.error('ไม่พบสินค้า');
      } else {
        toast.error(`พบ ${list.length} รายการ ระบุให้ชัดเจนขึ้น`);
      }
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const updateLine = (i: number, field: keyof DiscardLine, value: string | number) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (lines.length === 0) { toast.error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    setIsSaving(true);
    let successCount = 0;
    try {
      for (const line of lines) {
        try {
          await inventoryApi.discard({
            productId: line.product.id as string,
            quantity: line.quantity,
            unit: line.unit,
            reasonCode: line.reasonCode,
            notes: line.notes || undefined,
          });
          successCount++;
        } catch (err: unknown) {
          const e = err as { response?: { data?: { message?: string } } };
          toast.error(`"${line.product.nameTh}": ${e.response?.data?.message || 'ผิดพลาด'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`เคลียร์สินค้าแล้ว ${successCount} รายการ`);
        setLines([]);
        barcodeRef.current?.focus();
      }
    } finally { setIsSaving(false); }
  };

  // ── Report ───────────────────────────────────────────────────────
  const loadReport = async () => {
    setIsLoadingReport(true);
    try {
      const res = await inventoryApi.discardSummary(year, month);
      setSummary(res.data);
    } catch { toast.error('โหลดรายงานไม่สำเร็จ'); }
    finally { setIsLoadingReport(false); }
  };

  const MONTH_TH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trash2 size={20} className="text-red-500" />
          <h1 className="text-lg font-bold text-gray-900">เคลียร์สินค้า / ของเสีย</h1>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([['discard', 'บันทึกเคลียร์', Trash2], ['report', 'รายงานประจำเดือน', BarChart3]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'discard' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Scanner */}
          <div className="bg-white rounded-xl border-2 border-red-200 p-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">สแกน / ค้นหาสินค้า</label>
            <form onSubmit={handleScan} className="flex gap-2">
              <div className="flex-1 relative">
                <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
                <input ref={barcodeRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
                  placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้า..."
                  className="w-full border border-red-200 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-red-400" />
              </div>
              <button type="submit" className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition">สแกน</button>
              <button type="button" onClick={handleSearch}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition flex items-center gap-1.5">
                <Search size={14} /> ค้นหา
              </button>
            </form>
          </div>

          {lines.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-red-50/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">คงเหลือ</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-32">จำนวนที่เคลียร์</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-40">เหตุผล</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">หมายเหตุ</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-red-50/20">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-800">{line.product.nameTh as string}</div>
                        <div className="text-xs text-gray-400 font-mono">
                          {line.scannedBarcode || (line.product.barcode as string)}
                          {line.scanKind === 'pack' && line.scanRatio && line.scanRatio > 1 && (
                            <span className="ml-2 text-red-500">PACK ×{line.scanRatio}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className="text-sm font-bold text-gray-700">{line.product.currentStock as number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => updateLine(i, 'quantity', Math.max(1, line.quantity - 1))}
                            className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100">-</button>
                          <input type="number" value={line.quantity} min={1}
                            onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                            className="w-16 text-center border border-red-200 rounded-lg py-1 text-sm outline-none focus:border-red-400" />
                          <button onClick={() => updateLine(i, 'quantity', line.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={line.reasonCode} onChange={e => updateLine(i, 'reasonCode', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-red-400 bg-white">
                          {reasonCodes.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input value={line.notes} onChange={e => updateLine(i, 'notes', e.target.value)}
                          placeholder="(ถ้ามี)"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-red-400" />
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => removeLine(i)}
                          className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-100 bg-red-50/30 px-5 py-3 flex justify-end">
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
                  {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  บันทึกเคลียร์สินค้า
                </button>
              </div>
            </div>
          )}

          {lines.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400 text-sm">
              สแกนหรือค้นหาสินค้าที่ต้องการเคลียร์
            </div>
          )}
        </div>
      ) : (
        // Report tab
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <CalendarDays size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">เดือน</span>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-400 bg-white">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{MONTH_TH[m]}</option>
              ))}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-400 bg-white">
              {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y + 543}</option>)}
            </select>
            <button onClick={loadReport} disabled={isLoadingReport}
              className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-lg text-sm transition">
              {isLoadingReport ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
              ดูรายงาน
            </button>
          </div>

          {summary && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(summary.byReason).map(([code, data]) => (
                  <div key={code} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase">{data.label || code}</div>
                    <div className="text-2xl font-bold text-red-600 mt-1">{data.totalQty.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-0.5">ชิ้น / มูลค่า {data.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</div>
                    <div className="text-xs text-gray-400">{data.count} รายการ</div>
                  </div>
                ))}
                {Object.keys(summary.byReason).length === 0 && (
                  <div className="col-span-3 text-center py-8 text-gray-400 text-sm">ไม่มีข้อมูลเดือนนี้</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
