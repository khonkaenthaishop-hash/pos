'use client';
import { useState, useEffect, useRef } from 'react';
import { inventoryApi, productsApi } from '@/lib/api';
import { getProductScanMeta } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ScanLine, Search, Plus, Trash2, Loader2, PackagePlus } from 'lucide-react';

type Product = Record<string, unknown>;
type ReasonCode = { code: string; label: string };

type LineItem = {
  product: Product;
  quantity: number;
  unit: string;
  costPrice: string;
  scannedBarcode?: string;
  scanKind?: 'unit' | 'pack';
  scanRatio?: number;
};

export default function ReceivePage() {
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [referenceNo, setReferenceNo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [reasonCode, setReasonCode] = useState('PO');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([inventoryApi.reasonCodes('IN'), inventoryApi.suppliers()])
      .then(([rcRes, supRes]) => {
        setReasonCodes(rcRes.data || []);
        setSuppliers(supRes.data || []);
      });
    barcodeRef.current?.focus();
  }, []);

  const handleScan = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      const scanned = barcodeInput.trim();
      const res = await productsApi.byBarcode(scanned, { mode: 'inventory' });
      const product = res.data;
      if (!product) { toast.error('ไม่พบสินค้า'); return; }
      const scan = getProductScanMeta(product);
      const unit = scan?.kind === 'pack'
        ? String((product as Record<string, unknown>).wholesaleUnit || (product as Record<string, unknown>).unit || 'ชิ้น')
        : String((product as Record<string, unknown>).unit || 'ชิ้น');
      const ratio = Number(scan?.ratio || 1);
      const baseCost = Number((product as Record<string, unknown>).costPrice || 0);
      const costInput = scan?.kind === 'pack'
        ? (baseCost > 0 && ratio > 1 ? (baseCost * ratio).toFixed(2) : '')
        : String((product as Record<string, unknown>).costPrice || '');
      const exists = lines.findIndex(l => l.product.id === product.id && l.unit === unit);
      if (exists >= 0) {
        // เพิ่มจำนวนถ้าสแกนซ้ำ
        setLines(prev => prev.map((l, i) => i === exists ? { ...l, quantity: l.quantity + 1 } : l));
      } else {
        setLines(prev => [...prev, {
          product,
          quantity: 1,
          unit,
          costPrice: costInput,
          scannedBarcode: scanned,
          scanKind: scan?.kind === 'pack' ? 'pack' : 'unit',
          scanRatio: ratio,
        }]);
      }
      setBarcodeInput('');
      barcodeRef.current?.focus();
    } catch { toast.error('ไม่พบสินค้าจากบาร์โค้ดนี้'); }
  };

  const handleSearchProduct = async () => {
    if (!barcodeInput.trim()) return;
    try {
      const res = await productsApi.list({ search: barcodeInput.trim() });
      const list = res.data || [];
      if (list.length === 1) {
        const product = list[0];
        setLines(prev => [...prev, {
          product,
          quantity: 1,
          unit: String(product.unit || 'ชิ้น'),
          costPrice: String(product.costPrice || ''),
        }]);
        setBarcodeInput('');
      } else if (list.length === 0) {
        toast.error('ไม่พบสินค้า');
      } else {
        toast.error(`พบ ${list.length} รายการ กรุณาระบุให้ชัดเจนขึ้น`);
      }
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const updateLine = (i: number, field: keyof LineItem, value: string | number) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (lines.length === 0) { toast.error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    setIsSaving(true);
    try {
      for (const line of lines) {
        await inventoryApi.receive({
          productId: line.product.id as string,
          quantity: line.quantity,
          unit: line.unit,
          costPrice: line.costPrice ? Number(line.costPrice) : undefined,
          referenceNo: referenceNo || undefined,
          reasonCode,
          notes: notes || undefined,
          supplierId: supplierId || undefined,
        });
      }
      toast.success(`รับสินค้าเข้าคลังแล้ว ${lines.length} รายการ`);
      setLines([]);
      setReferenceNo('');
      setNotes('');
      barcodeRef.current?.focus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setIsSaving(false); }
  };

  const totalItems = lines.reduce((s, l) => s + l.quantity, 0);
  const totalCost = lines.reduce((s, l) => s + (Number(l.costPrice) || 0) * l.quantity, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center gap-3">
        <PackagePlus size={20} className="text-orange-500" />
        <h1 className="text-lg font-bold text-gray-900">รับสินค้าเข้าคลัง</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Header info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">เลขที่ใบส่งของ / PO</label>
              <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                placeholder="เช่น PO-2025-001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                <option value="">— เลือก Supplier —</option>
                {suppliers.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">เหตุผล</label>
              <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                {reasonCodes.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">หมายเหตุ</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="(ถ้ามี)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
            </div>
          </div>
        </div>

        {/* Barcode scanner */}
        <div className="bg-white rounded-xl border-2 border-orange-300 p-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">สแกน / ค้นหาสินค้า</label>
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="flex-1 relative">
              <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
              <input ref={barcodeRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
                placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้า..."
                className="w-full border border-orange-200 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-orange-400" />
            </div>
            <button type="submit"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition">
              สแกน
            </button>
            <button type="button" onClick={handleSearchProduct}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition flex items-center gap-1.5">
              <Search size={14} /> ค้นหา
            </button>
          </form>
        </div>

        {/* Line items */}
        {lines.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-32">จำนวน</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">หน่วย</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-36">ราคาทุน ฿</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">รวม ฿</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{line.product.nameTh as string}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {line.scannedBarcode || (line.product.barcode as string)}
                        {line.scanKind === 'pack' && line.scanRatio && line.scanRatio > 1 && (
                          <span className="ml-2 text-orange-500">PACK ×{line.scanRatio}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => updateLine(i, 'quantity', Math.max(1, line.quantity - 1))}
                          className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-600">-</button>
                        <input type="number" value={line.quantity} min={1}
                          onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                          className="w-16 text-center border border-gray-200 rounded-lg py-1 text-sm outline-none focus:border-orange-400" />
                        <button onClick={() => updateLine(i, 'quantity', line.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-100 text-gray-600">+</button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-orange-400" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={line.costPrice}
                        onChange={e => updateLine(i, 'costPrice', e.target.value)}
                        placeholder="0.00" step="0.01"
                        className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-400" />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      {((Number(line.costPrice) || 0) * line.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => removeLine(i)}
                        className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer summary */}
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">รวม {lines.length} รายการ / {totalItems} ชิ้น</span>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">
                  มูลค่ารับเข้า: {totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                </span>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
                  {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  บันทึกรับเข้า
                </button>
              </div>
            </div>
          </div>
        )}

        {lines.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400 text-sm">
            สแกนหรือค้นหาสินค้าเพื่อเพิ่มรายการ
          </div>
        )}
      </div>
    </div>
  );
}
