'use client';
import { useState, useEffect } from 'react';
import { inventoryApi, productsApi, categoriesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { ClipboardList, Search, Loader2, ChevronDown, CheckCircle2 } from 'lucide-react';

type Product = Record<string, unknown>;
type Category = { id: string; nameTh: string; icon?: string | null };
type ReasonCode = { code: string; label: string };

type CountRow = {
  product: Product;
  systemQty: number;
  physicalCount: string;
  reasonCode: string;
  notes: string;
};

export default function AdjustPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [rows, setRows] = useState<Record<string, CountRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes, rcRes] = await Promise.all([
        productsApi.list({ search: search || undefined, categoryId: filterCategoryId || undefined }),
        categoriesApi.list(),
        inventoryApi.reasonCodes('ADJUST'),
      ]);
      setProducts(prodRes.data || []);
      setCategories((catRes.data || []) as Category[]);
      setReasonCodes(rcRes.data || []);
    } finally { setIsLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [filterCategoryId]);

  const getRow = (p: Product): CountRow => rows[p.id as string] || {
    product: p,
    systemQty: Number(p.currentStock),
    physicalCount: '',
    reasonCode: 'STOCK_TAKE',
    notes: '',
  };

  const updateRow = (id: string, field: keyof CountRow, value: string) => {
    setRows(prev => ({ ...prev, [id]: { ...getRow(products.find(p => p.id === id)!), [field]: value } }));
  };

  const handleSave = async (p: Product) => {
    const row = getRow(p);
    if (row.physicalCount === '') { toast.error('กรุณาใส่จำนวนที่นับจริง'); return; }
    const physical = Number(row.physicalCount);
    const system = Number(p.currentStock);
    if (physical === system) { toast.error('ยอดเท่ากับในระบบ ไม่ต้องปรับ'); return; }

    setSavingId(p.id as string);
    try {
      await inventoryApi.adjust({
        productId: p.id as string,
        physicalCount: physical,
        reasonCode: row.reasonCode,
        notes: row.notes || undefined,
      });
      const variance = physical - system;
      toast.success(`ปรับยอด "${p.nameTh}" ${variance > 0 ? '+' : ''}${variance} ${p.unit}`);
      setRows(prev => { const n = { ...prev }; delete n[p.id as string]; return n; });
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSavingId(null); }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center gap-3">
        <ClipboardList size={20} className="text-blue-500" />
        <h1 className="text-lg font-bold text-gray-900">นับสต็อก / ปรับยอด</h1>
        <span className="text-xs text-gray-400">ใส่จำนวนที่นับจริง ระบบจะคำนวณส่วนต่างให้อัตโนมัติ</span>
      </div>

      {/* Search + Filter */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <form onSubmit={e => { e.preventDefault(); loadData(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้า..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="relative">
            <select value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)}
              className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:border-blue-400 bg-white text-gray-600">
              <option value="">ทุกหมวดหมู่</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.nameTh}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm transition">ค้นหา</button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">สินค้า</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">ยอดในระบบ</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-32">ยอดนับจริง</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">ส่วนต่าง</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-40">เหตุผล</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">หมายเหตุ</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
                  </div>
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-300 text-sm">ไม่พบสินค้า</td></tr>
              ) : products.map(p => {
                const row = getRow(p);
                const physical = row.physicalCount !== '' ? Number(row.physicalCount) : null;
                const system = Number(p.currentStock);
                const variance = physical !== null ? physical - system : null;
                const hasChange = variance !== null && variance !== 0;
                return (
                  <tr key={p.id as string}
                    className={`border-t border-gray-50 transition-colors ${hasChange ? 'bg-amber-50/40' : 'hover:bg-gray-50/30'}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{p.nameTh as string}</div>
                      <div className="text-xs text-gray-400">{p.barcode as string || ''} {p.unit ? `/ ${p.unit}` : ''}</div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${
                        system === 0 ? 'text-red-600 bg-red-50' : system <= Number(p.minStock) ? 'text-amber-600 bg-amber-50' : 'text-gray-700 bg-gray-100'
                      }`}>{system}</span>
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={row.physicalCount} min={0}
                        onChange={e => updateRow(p.id as string, 'physicalCount', e.target.value)}
                        placeholder="—"
                        className={`w-20 text-center border rounded-lg py-1.5 text-sm outline-none ${hasChange ? 'border-amber-400 focus:border-amber-500' : 'border-gray-200 focus:border-blue-400'}`} />
                    </td>
                    <td className="text-center px-4 py-3">
                      {variance !== null && variance !== 0 ? (
                        <span className={`text-sm font-bold ${variance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {variance > 0 ? '+' : ''}{variance}
                        </span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select value={row.reasonCode} onChange={e => updateRow(p.id as string, 'reasonCode', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white">
                        {reasonCodes.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input value={row.notes} onChange={e => updateRow(p.id as string, 'notes', e.target.value)}
                        placeholder="(ถ้ามี)"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-400" />
                    </td>
                    <td className="px-4 py-3">
                      {hasChange && (
                        <button onClick={() => handleSave(p)} disabled={savingId === p.id as string}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition">
                          {savingId === p.id as string
                            ? <Loader2 size={12} className="animate-spin" />
                            : <CheckCircle2 size={12} />}
                          ปรับยอด
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
