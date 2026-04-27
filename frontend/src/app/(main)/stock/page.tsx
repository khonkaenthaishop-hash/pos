'use client';
import { Fragment, useState, useEffect } from 'react';
import { productsApi, categoriesApi } from '@/lib/api';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  Package, AlertTriangle, XCircle, Minus, Plus, Search,
  Loader2, ChevronDown, Eye, EyeOff, Pencil, Trash2, Tag,
} from 'lucide-react';

type Product = Record<string, unknown>;
type Category = { id: string; nameTh: string; icon?: string | null };

const TEMP_LABEL: Record<string, string> = { normal: 'ธรรมดา', cold: 'เย็น', frozen: 'แช่แข็ง' };

const emptyAddForm = {
  nameTh: '', nameZh: '', nameEn: '', barcode: '',
  categoryId: '', retailPrice: '', wholesalePrice: '',
  costPrice: '', unit: 'ชิ้น', minStock: '5', temperatureType: 'normal',
};

export default function StockPage() {
  const { data: session } = useSession();
  const isOwner = (session?.user as Record<string, string> | null | undefined)?.role === 'owner';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Stock adjust state
  const [adjust, setAdjust] = useState<Record<string, { qty: number; reason: string }>>({});

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);

  // Edit form
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyAddForm);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.list({
          search: search || undefined,
          categoryId: filterCategoryId || undefined,
          lowStock: showLowOnly ? 'true' : undefined,
          includeInactive: showHidden ? 'true' : undefined,
        }),
        categoriesApi.list(),
      ]);
      setProducts(prodRes.data || []);
      setCategories((catRes.data || []) as Category[]);
    } finally { setIsLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [filterCategoryId, showLowOnly, showHidden]);

  // ── Stock adjust ──────────────────────────────────────────────────
  const getAdj = (id: string) => adjust[id] || { qty: 0, reason: '' };
  const setQty = (id: string, qty: number) => setAdjust(a => ({ ...a, [id]: { ...getAdj(id), qty } }));
  const setReason = (id: string, r: string) => setAdjust(a => ({ ...a, [id]: { ...getAdj(id), reason: r } }));

  const handleAdjust = async (id: string) => {
    const { qty, reason } = getAdj(id);
    if (qty === 0) { toast.error('ระบุจำนวนที่ต้องการปรับ'); return; }
    try {
      await productsApi.adjustStock(id, { adjustment: qty, reason });
      toast.success('ปรับสต็อคสำเร็จ');
      setAdjust(a => { const n = { ...a }; delete n[id]; return n; });
      loadData();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  // ── Add ───────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.nameTh || !addForm.retailPrice) { toast.error('กรุณากรอกชื่อและราคา'); return; }
    try {
      await productsApi.create({
        ...addForm,
        retailPrice: Number(addForm.retailPrice),
        wholesalePrice: addForm.wholesalePrice ? Number(addForm.wholesalePrice) : null,
        costPrice: addForm.costPrice ? Number(addForm.costPrice) : 0,
        minStock: Number(addForm.minStock),
      });
      toast.success('เพิ่มสินค้าแล้ว');
      setShowAddForm(false);
      setAddForm(emptyAddForm);
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────
  const openEdit = (p: Product) => {
    setEditId(p.id as string);
    setEditForm({
      nameTh: String(p.nameTh || ''),
      nameZh: String(p.nameZh || ''),
      nameEn: String(p.nameEn || ''),
      barcode: String(p.barcode || ''),
      categoryId: String(p.categoryId || ''),
      retailPrice: String(p.retailPrice || ''),
      wholesalePrice: String(p.wholesalePrice || ''),
      costPrice: String(p.costPrice || ''),
      unit: String(p.unit || 'ชิ้น'),
      minStock: String(p.minStock || '5'),
      temperatureType: String(p.temperatureType || 'normal'),
    });
  };

  const handleEdit = async () => {
    if (!editId) return;
    try {
      // Non-price fields via general update
      await productsApi.update(editId, {
        nameTh: editForm.nameTh,
        nameZh: editForm.nameZh || undefined,
        nameEn: editForm.nameEn || undefined,
        barcode: editForm.barcode || undefined,
        categoryId: editForm.categoryId || undefined,
        unit: editForm.unit,
        minStock: Number(editForm.minStock),
        temperatureType: editForm.temperatureType,
      });
      // Price fields via audited price endpoint (owner-only)
      if (isOwner && (editForm.retailPrice || editForm.wholesalePrice || editForm.costPrice)) {
        await productsApi.updatePrice(editId, {
          retailPrice: editForm.retailPrice ? Number(editForm.retailPrice) : undefined,
          wholesalePrice: editForm.wholesalePrice ? Number(editForm.wholesalePrice) : undefined,
          costPrice: editForm.costPrice ? Number(editForm.costPrice) : undefined,
        });
      }
      toast.success('แก้ไขสินค้าแล้ว');
      setEditId(null);
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  // ── Toggle active (ซ่อน/แสดง) ────────────────────────────────────
  const handleToggleActive = async (p: Product) => {
    const action = p.isActive ? 'ซ่อน' : 'แสดง';
    if (!window.confirm(`ต้องการ${action}สินค้า "${p.nameTh}" ใช่ไหม?`)) return;
    try {
      await productsApi.toggleActive(p.id as string);
      toast.success(`${action}สินค้าแล้ว`);
      loadData();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = async (p: Product) => {
    if (!window.confirm(`ลบสินค้า "${p.nameTh}" ถาวรเลยใช่ไหม?\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`)) return;
    try {
      await productsApi.remove(p.id as string);
      toast.success('ลบสินค้าแล้ว');
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const lowCount = products.filter(p => Number(p.currentStock) <= Number(p.minStock) && Number(p.currentStock) > 0).length;
  const emptyCount = products.filter(p => Number(p.currentStock) === 0).length;

  const getCatLabel = (catId: unknown) => {
    const c = categories.find(c => c.id === catId);
    return c ? `${c.icon ?? ''} ${c.nameTh}`.trim() : '';
  };

  const ProductForm = ({ form, setForm, onSave, onCancel, title }: {
    form: typeof emptyAddForm;
    setForm: (f: typeof emptyAddForm) => void;
    onSave: () => void;
    onCancel: () => void;
    title: string;
  }) => (
    <div className="bg-white rounded-xl border-2 border-orange-300 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Tag size={16} className="text-orange-500" />
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {([
          ['nameTh', 'ชื่อไทย *', 'col-span-2'],
          ['nameZh', 'ชื่อจีน (選填)', ''],
          ['nameEn', 'English name', ''],
          ['barcode', 'Barcode', ''],
        ] as [keyof typeof emptyAddForm, string, string][]).map(([key, placeholder, cls]) => (
          <input key={key} value={form[key]}
            onChange={e => setForm({ ...form, [key]: e.target.value })}
            placeholder={placeholder}
            className={`${cls} border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400`} />
        ))}
        <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
          <option value="">หมวดหมู่</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.nameTh}</option>)}
        </select>
        <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
          placeholder="หน่วย เช่น ชิ้น กล่อง"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
        {([
          ['retailPrice', 'ราคาปลีก ฿ *'],
          ['wholesalePrice', 'ราคาส่ง ฿'],
          ['costPrice', 'ราคาทุน ฿'],
          ['minStock', 'Min stock'],
        ] as [keyof typeof emptyAddForm, string][]).map(([key, placeholder]) => (
          <input key={key} type="number" value={form[key]}
            onChange={e => setForm({ ...form, [key]: e.target.value })}
            placeholder={placeholder}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
        ))}
        <select value={form.temperatureType} onChange={e => setForm({ ...form, temperatureType: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
          <option value="normal">ธรรมดา</option>
          <option value="cold">เย็น</option>
          <option value="frozen">แช่แข็ง</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave}
          className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm transition">
          บันทึก
        </button>
        <button onClick={onCancel}
          className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium text-sm transition">
          ยกเลิก
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">คลังสินค้า</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-gray-500">
              <Package size={14} className="text-gray-400" />
              ทั้งหมด <strong className="text-gray-900">{products.length}</strong>
            </span>
            <button onClick={() => setShowLowOnly(!showLowOnly)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition ${showLowOnly ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
              <AlertTriangle size={12} /> ใกล้หมด {lowCount}
            </button>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <XCircle size={12} className="text-red-400" /> หมด <strong className="text-red-600">{emptyCount}</strong>
            </span>
          </div>
          {isOwner && (
            <>
              <button onClick={() => setShowHidden(!showHidden)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${showHidden ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {showHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                {showHidden ? 'ซ่อนอยู่' : 'แสดงที่ซ่อน'}
              </button>
              <button onClick={() => { setShowAddForm(true); setEditId(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition">
                <Plus size={13} /> เพิ่มสินค้า
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <form onSubmit={e => { e.preventDefault(); loadData(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้า..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-orange-400" />
          </div>
          <div className="relative">
            <select value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)}
              className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:border-orange-400 bg-white text-gray-600">
              <option value="">ทุกหมวดหมู่</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.nameTh}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm transition">ค้นหา</button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Add Form */}
        {isOwner && showAddForm && (
          <ProductForm
            form={addForm} setForm={setAddForm}
            title="เพิ่มสินค้าใหม่"
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setAddForm(emptyAddForm); }}
          />
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สินค้า</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">หมวด</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สต็อค</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Min</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ปรับยอด</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">เหตุผล</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">บันทึก</th>
                {isOwner && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={isOwner ? 8 : 7} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
                  </div>
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={isOwner ? 8 : 7} className="text-center py-12 text-gray-300 text-sm">ไม่พบสินค้า</td></tr>
              ) : products.map((p) => {
                const id = p.id as string;
                const stock = Number(p.currentStock);
                const min = Number(p.minStock);
                const adj = getAdj(id);
                const isHidden = !p.isActive;
                const stockColor = stock === 0 ? 'text-red-600 bg-red-50' : stock <= min ? 'text-amber-600 bg-amber-50' : 'text-emerald-700 bg-emerald-50';

                return (
                  <Fragment key={id}>
                    <tr key={id}
                      className={`border-t border-gray-50 transition-colors ${isHidden ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {isHidden && <EyeOff size={12} className="text-gray-400 shrink-0" />}
                          <div>
                            <div className="font-medium text-gray-800 text-sm">{p.nameTh as string}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {!!p.barcode && <span className="text-xs text-gray-300 font-mono">{p.barcode as string}</span>}
                              {!!p.unit && <span className="text-xs text-gray-400">/ {p.unit as string}</span>}
                              <span className="text-xs text-gray-400">{TEMP_LABEL[p.temperatureType as string] || ''}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{getCatLabel(p.categoryId) || <span className="text-gray-200">—</span>}</td>
                      <td className="text-center px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${stockColor}`}>{stock}</span>
                      </td>
                      <td className="text-center px-4 py-3 text-xs text-gray-400">{min}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setQty(id, adj.qty - 1)}
                            className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600 transition">
                            <Minus size={12} />
                          </button>
                          <input type="number" value={adj.qty}
                            onChange={e => setQty(id, Number(e.target.value))}
                            className="w-14 text-center border border-gray-200 rounded-lg py-1 text-sm outline-none focus:border-orange-400" />
                          <button onClick={() => setQty(id, adj.qty + 1)}
                            className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600 transition">
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input value={adj.reason} onChange={e => setReason(id, e.target.value)}
                          placeholder="ระบุเหตุผล..."
                          className="w-36 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {adj.qty !== 0 && (
                          <button onClick={() => handleAdjust(id)}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition">
                            บันทึก
                          </button>
                        )}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => { setShowAddForm(false); openEdit(p); }}
                              title="แก้ไข"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleToggleActive(p)}
                              title={isHidden ? 'แสดง' : 'ซ่อน'}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg transition ${isHidden ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}>
                              {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                            </button>
                            <button onClick={() => handleDelete(p)}
                              title="ลบ"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {/* Edit row */}
                    {editId === id && (
                      <tr key={`${id}-edit`} className="border-t border-blue-100">
                        <td colSpan={isOwner ? 8 : 7} className="px-5 py-4 bg-blue-50/30">
                          <ProductForm
                            form={editForm} setForm={setEditForm}
                            title={`แก้ไข: ${p.nameTh}`}
                            onSave={handleEdit}
                            onCancel={() => setEditId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
