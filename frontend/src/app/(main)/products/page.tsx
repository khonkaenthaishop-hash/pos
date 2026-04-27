'use client';
import { useState, useEffect, useCallback, Fragment, startTransition } from 'react';
import { productsApi, categoriesApi, locationsApi, inventoryApi } from '@/lib/api';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Search, Plus, Check, Clock, Loader2, Tag, ChevronDown, MapPin, X, Building2, Pencil, Zap } from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import QuickAddProduct from '@/components/pos/QuickAddProduct';

const TEMP_LABEL: Record<string, string> = { normal: 'ธรรมดา', cold: 'เย็น', frozen: 'แช่แข็ง' };
const TEMP_STYLE: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-500',
  cold: 'bg-blue-50 text-blue-500',
  frozen: 'bg-cyan-50 text-cyan-600',
};

type Product = Record<string, unknown>;
type Category = { id: string; nameTh: string; icon?: string | null };
type Supplier = { id: string; name: string; isActive?: boolean };
type LocationOption = { id: number; fullCode: string; zone?: string; aisle?: string; shelf?: string; bin?: string };

// Profit helpers
function calcProfit(price: string, cost: string) {
  const p = Number(price); const c = Number(cost);
  if (!p || !c) return null;
  const amt = p - c;
  const pct = c > 0 ? ((amt / c) * 100).toFixed(1) : '∞';
  return { amt, pct };
}
function psychPrice(n: number) {
  if (n <= 0) return [];
  const base = Math.ceil(n);
  const candidates = [base - 1, Math.ceil(n / 5) * 5 - 1, Math.ceil(n / 10) * 10 - 1].filter(v => v > 0);
  return [...new Set(candidates)].sort((a, b) => a - b);
}
const UNITS_DEFAULT = ['ชิ้น', 'กล่อง', 'ถุง', 'แพ็ค', 'โหล', 'กระสอบ', 'ขวด', 'กระป๋อง', 'แผ่น', 'ม้วน'];

function previewAutoSku() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `SKU-${ts}-${rand}`;
}

export default function ProductsPage() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, string> | null | undefined)?.role || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [showPending, setShowPending] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({ retailPrice: '', wholesalePrice: '', costPrice: '' });
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  type LocationRow = { locationId: number; fullCode: string; quantity: number; priority: number };
  const [locationRows, setLocationRows] = useState<LocationRow[]>([]);

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // All locations for modal picker
  const [allLocations, setAllLocations] = useState<LocationOption[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  // Custom units (localStorage)
  const [units, setUnits] = useState<string[]>(() => {
    if (typeof window === 'undefined') return UNITS_DEFAULT;
    try { return JSON.parse(localStorage.getItem('pos_units') || 'null') || UNITS_DEFAULT; } catch { return UNITS_DEFAULT; }
  });
  const [newUnit, setNewUnit] = useState('');
  const [showUnitManager, setShowUnitManager] = useState(false);
  // SKU preview for add form
  const [skuPreview, setSkuPreview] = useState('');
  // Supplier modal
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  const EMPTY_ADD_FORM = {
    nameTh: '', nameZh: '', nameEn: '', barcode: '', packBarcode: '', sku: '', categoryId: '',
    retailPrice: '', wholesalePrice: '', costPrice: '',
    promoQty: '', promoPrice: '',
    unit: 'ชิ้น', minStock: '5', temperatureType: 'normal',
    vatRate: '7', minWholesaleQty: '1',
    baseUnit: '', wholesaleUnit: '', conversionFactor: '1',
    expiryDate: '', lotNumber: '',
    locationCode: '', pickSequence: '0',
    supplierId: '', imageUrl: '', descriptionTh: '',
  };
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.list({
          search: search || undefined,
          pending: showPending || undefined,
          categoryId: filterCategoryId || undefined,
        }),
        categoriesApi.list(),
      ]);
      setProducts(prodRes.data || []);
      setCategories((catRes.data || []) as Category[]);
    } finally { setIsLoading(false); }
  }, [showPending, filterCategoryId, search]);

  useEffect(() => { startTransition(() => { void loadData(); }); }, [loadData]);

  // Load suppliers + locations once
  useEffect(() => {
    inventoryApi.suppliers().then(r => setSuppliers((r.data || []) as Supplier[])).catch(() => {});
    locationsApi.list().then(r => setAllLocations((r.data || []) as LocationOption[])).catch(() => {});
  }, []);

  const saveUnits = useCallback((next: string[]) => {
    setUnits(next);
    if (typeof window !== 'undefined') localStorage.setItem('pos_units', JSON.stringify(next));
  }, []);

  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) { toast.error('กรอกชื่อ supplier'); return; }
    setIsCreatingSupplier(true);
    try {
      const res = await inventoryApi.createSupplier({ ...supplierForm });
      const created = res.data as Supplier;
      setSuppliers(s => [...s, created]);
      setAddForm(f => ({ ...f, supplierId: created.id }));
      setSupplierForm({ name: '', phone: '', email: '', address: '' });
      setShowSupplierModal(false);
      toast.success('เพิ่ม supplier แล้ว');
    } catch { toast.error('เกิดข้อผิดพลาด'); }
    finally { setIsCreatingSupplier(false); }
  };

  const resetProductForm = () => {
    setShowAddForm(false);
    setEditProductId(null);
    setAddForm(EMPTY_ADD_FORM);
    setSkuPreview('');
    setShowLocationModal(false);
    setLocationSearch('');
    setShowSupplierModal(false);
    setSupplierForm({ name: '', phone: '', email: '', address: '' });
  };

  const openCreateProduct = () => {
    setEditProductId(null);
    setAddForm(EMPTY_ADD_FORM);
    setShowAddForm(true);
    setSkuPreview(previewAutoSku());
  };

  const openEditProduct = (p: Product) => {
    const expiry = (p.expiryDate as string | undefined) || '';
    const expiryDate = expiry ? String(expiry).slice(0, 10) : '';

    setEditProductId(p.id as string);
    setShowAddForm(true);
    setSkuPreview('');
    setAddForm({
      ...EMPTY_ADD_FORM,
      nameTh: String(p.nameTh || ''),
      nameZh: String(p.nameZh || ''),
      nameEn: String(p.nameEn || ''),
      barcode: String(p.barcode || ''),
      packBarcode: String((p as Record<string, unknown>).packBarcode || ''),
      sku: String(p.sku || ''),
      categoryId: String(p.categoryId || ''),
      retailPrice: p.retailPrice != null ? String(p.retailPrice) : '',
      wholesalePrice: p.wholesalePrice != null ? String(p.wholesalePrice) : '',
      costPrice: p.costPrice != null ? String(p.costPrice) : '',
      promoQty: (p as Record<string, unknown>).promoQty != null ? String((p as Record<string, unknown>).promoQty) : '',
      promoPrice: (p as Record<string, unknown>).promoPrice != null ? String((p as Record<string, unknown>).promoPrice) : '',
      unit: String(p.unit || 'ชิ้น'),
      minStock: p.minStock != null ? String(p.minStock) : '5',
      temperatureType: String(p.temperatureType || 'normal'),
      vatRate: p.vatRate != null ? String(p.vatRate) : '7',
      minWholesaleQty: p.minWholesaleQty != null ? String(p.minWholesaleQty) : '1',
      baseUnit: String(p.baseUnit || ''),
      wholesaleUnit: String(p.wholesaleUnit || ''),
      conversionFactor: p.conversionFactor != null ? String(p.conversionFactor) : '1',
      expiryDate,
      lotNumber: String(p.lotNumber || ''),
      locationCode: String(p.locationCode || ''),
      pickSequence: p.pickSequence != null ? String(p.pickSequence) : '0',
      supplierId: String(p.supplierId || ''),
      imageUrl: String(p.imageUrl || ''),
      descriptionTh: String(p.descriptionTh || ''),
    });
  };


  const handleAdd = async () => {
    if (!addForm.nameTh || !addForm.retailPrice) { toast.error('กรุณากรอกชื่อและราคา'); return; }
    if (Number(addForm.retailPrice) < 0) { toast.error('ราคาขายต้องไม่ติดลบ'); return; }
    if (addForm.costPrice && Number(addForm.costPrice) < 0) { toast.error('ราคาทุนต้องไม่ติดลบ'); return; }
    if (addForm.wholesalePrice && Number(addForm.wholesalePrice) < 0) { toast.error('ราคาส่งต้องไม่ติดลบ'); return; }
    try {
      await productsApi.create({
        ...addForm,
        retailPrice: Number(addForm.retailPrice),
        wholesalePrice: addForm.wholesalePrice ? Number(addForm.wholesalePrice) : undefined,
        costPrice: addForm.costPrice ? Number(addForm.costPrice) : 0,
        promoQty: addForm.promoQty ? Number(addForm.promoQty) : undefined,
        promoPrice: addForm.promoPrice ? Number(addForm.promoPrice) : undefined,
        minStock: Number(addForm.minStock),
        vatRate: addForm.vatRate ? Number(addForm.vatRate) : 7,
        minWholesaleQty: addForm.minWholesaleQty ? Number(addForm.minWholesaleQty) : 1,
        conversionFactor: addForm.conversionFactor ? Number(addForm.conversionFactor) : 1,
        pickSequence: addForm.pickSequence ? Number(addForm.pickSequence) : 0,
        baseUnit: addForm.baseUnit || undefined,
        wholesaleUnit: addForm.wholesaleUnit || undefined,
        expiryDate: addForm.expiryDate || undefined,
        lotNumber: addForm.lotNumber || undefined,
        locationCode: addForm.locationCode || undefined,
        sku: addForm.sku?.trim() || undefined,
        packBarcode: addForm.packBarcode?.trim() || undefined,
        supplierId: addForm.supplierId || undefined,
        imageUrl: addForm.imageUrl || undefined,
        descriptionTh: addForm.descriptionTh || undefined,
      });
      toast.success('เพิ่มสินค้าแล้ว (รออนุมัติ)');
      resetProductForm();
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!addForm.nameTh || !addForm.retailPrice) { toast.error('กรุณากรอกชื่อและราคา'); return; }
    if (Number(addForm.retailPrice) < 0) { toast.error('ราคาขายต้องไม่ติดลบ'); return; }
    if (addForm.costPrice && Number(addForm.costPrice) < 0) { toast.error('ราคาทุนต้องไม่ติดลบ'); return; }
    if (addForm.wholesalePrice && Number(addForm.wholesalePrice) < 0) { toast.error('ราคาส่งต้องไม่ติดลบ'); return; }

    try {
      await productsApi.update(id, {
        ...addForm,
        retailPrice: Number(addForm.retailPrice),
        wholesalePrice: addForm.wholesalePrice ? Number(addForm.wholesalePrice) : null,
        costPrice: addForm.costPrice ? Number(addForm.costPrice) : 0,
        promoQty: addForm.promoQty ? Number(addForm.promoQty) : null,
        promoPrice: addForm.promoPrice ? Number(addForm.promoPrice) : null,
        minStock: Number(addForm.minStock),
        vatRate: addForm.vatRate ? Number(addForm.vatRate) : 7,
        minWholesaleQty: addForm.minWholesaleQty ? Number(addForm.minWholesaleQty) : 1,
        conversionFactor: addForm.conversionFactor ? Number(addForm.conversionFactor) : 1,
        pickSequence: addForm.pickSequence ? Number(addForm.pickSequence) : 0,
        categoryId: addForm.categoryId || null,
        baseUnit: addForm.baseUnit || null,
        wholesaleUnit: addForm.wholesaleUnit || null,
        expiryDate: addForm.expiryDate || null,
        lotNumber: addForm.lotNumber || null,
        locationCode: addForm.locationCode || null,
        sku: addForm.sku?.trim() || null,
        packBarcode: addForm.packBarcode?.trim() || null,
        supplierId: addForm.supplierId || null,
        imageUrl: addForm.imageUrl || null,
        descriptionTh: addForm.descriptionTh || null,
      });
      toast.success('บันทึกการแก้ไขแล้ว');
      resetProductForm();
      setEditPriceId(null);
      setEditLocationId(null);
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleApprove = async (id: string) => {
    try { await productsApi.approve(id); toast.success('อนุมัติสินค้าแล้ว'); loadData(); }
    catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const handleUpdatePrice = async (id: string) => {
    try {
      await productsApi.updatePrice(id, {
        retailPrice: priceForm.retailPrice ? Number(priceForm.retailPrice) : undefined,
        wholesalePrice: priceForm.wholesalePrice ? Number(priceForm.wholesalePrice) : undefined,
        costPrice: priceForm.costPrice ? Number(priceForm.costPrice) : undefined,
      });
      toast.success('อัปเดตราคาแล้ว');
      setEditPriceId(null);
      loadData();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const handleOpenLocationEditor = async (id: string) => {
    if (editLocationId === id) { setEditLocationId(null); return; }
    try {
      const res = await locationsApi.getProductLocations(id);
      setLocationRows((res.data as LocationRow[]) || []);
      setEditLocationId(id);
    } catch { toast.error('โหลดตำแหน่งไม่ได้'); }
  };

  const handleSaveLocations = async (id: string) => {
    try {
      await locationsApi.updateProductLocations(id, locationRows.map(r => ({
        locationId: r.locationId,
        quantity: r.quantity,
        priority: r.priority,
      })));
      toast.success('บันทึกตำแหน่งแล้ว');
      setEditLocationId(null);
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const getCategoryName = (categoryId: unknown) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon ? cat.icon + ' ' : ''}${cat.nameTh}` : null;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {showQuickAdd && (
        <QuickAddProduct
          onClose={() => setShowQuickAdd(false)}
          onSaved={() => void loadData()}
        />
      )}
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold text-gray-900">จัดการสินค้า</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPending(!showPending)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${showPending ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Clock size={15} />
            รออนุมัติ
          </button>
          <button onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition">
            <Zap size={15} />
            Quick Add
          </button>
          <button onClick={openCreateProduct}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition">
            <Plus size={15} />
            เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <form onSubmit={e => { e.preventDefault(); loadData(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า หรือ Barcode..."
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
        {/* ── Add Form ─────────────────────────────────────────────── */}
        {showAddForm && (() => {
          const cost = Number(addForm.costPrice);
          const wholesale = Number(addForm.wholesalePrice);
          const retailProfit = calcProfit(addForm.retailPrice, addForm.costPrice);
          const ratio = Math.max(1, Number(addForm.conversionFactor) || 1);
          const wProfit = ratio > 1 ? calcProfit(addForm.wholesalePrice, String(cost * ratio)) : calcProfit(addForm.wholesalePrice, addForm.costPrice);
          const wSugg = cost > 0 ? [Math.round(cost * 1.5), Math.round(cost * 2)] : [];
          const rSugg = cost > 0 ? [Math.round(wholesale > 0 ? wholesale * 1.5 : cost * 2.5), Math.round(wholesale > 0 ? wholesale * 2 : cost * 3)] : [];
          const filteredLocs = allLocations.filter(l => l.fullCode.toLowerCase().includes(locationSearch.toLowerCase()));

          return (
            <div className="bg-white rounded-xl border-2 border-orange-300 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-orange-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">{editProductId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
                </div>
                <button onClick={resetProductForm}
                  className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>

              {/* ── Section 1: ข้อมูลทั่วไป ── */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ข้อมูลทั่วไป</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">ชื่อไทย <span className="text-red-400">*</span></label>
                    <input value={addForm.nameTh} onChange={e => setAddForm(f => ({ ...f, nameTh: e.target.value }))}
                      placeholder="เช่น น้ำปลาทิพรส 700ml"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ชื่อจีน</label>
                    <input value={addForm.nameZh} onChange={e => setAddForm(f => ({ ...f, nameZh: e.target.value }))}
                      placeholder="เช่น 魚露"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ชื่ออังกฤษ</label>
                    <input value={addForm.nameEn} onChange={e => setAddForm(f => ({ ...f, nameEn: e.target.value }))}
                      placeholder="เช่น Fish Sauce 700ml"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Barcode</label>
                    <input value={addForm.barcode} onChange={e => setAddForm(f => ({ ...f, barcode: e.target.value }))}
                      placeholder="เช่น 8850006101019"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Barcode (Pack)</label>
                    <input value={addForm.packBarcode} onChange={e => setAddForm(f => ({ ...f, packBarcode: e.target.value }))}
                      placeholder="เช่น 8850006101026"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                    <p className="text-[11px] text-gray-300 mt-1">ใช้สำหรับสแกนรับของ/ขายแบบแพ็ค (คูณตาม Conversion Ratio)</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">SKU <span className="text-gray-300">(เว้นว่างเพื่อให้ระบบสร้างอัตโนมัติ)</span></label>
                    <input value={addForm.sku ?? ''} onChange={e => setAddForm(f => ({ ...f, sku: e.target.value }))}
                      placeholder={skuPreview}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono placeholder-gray-300" />
                    {!addForm.sku && (
                      <p className="text-xs text-gray-400 mt-1">จะได้รับ: <span className="font-mono text-orange-400">{skuPreview}</span></p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">หมวดหมู่</label>
                    <select value={addForm.categoryId} onChange={e => setAddForm(f => ({ ...f, categoryId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                      <option value="">— เลือกหมวดหมู่ —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.nameTh}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">หน่วยนับ</label>
                      <button type="button" onClick={() => setShowUnitManager(v => !v)}
                        className="text-xs text-orange-500 hover:underline">จัดการหน่วย</button>
                    </div>
                    <select value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {showUnitManager && (
                      <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
                        <div className="flex gap-2">
                          <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
                            placeholder="หน่วยใหม่ เช่น ลัง"
                            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
                          <button onClick={() => {
                            if (!newUnit.trim() || units.includes(newUnit.trim())) return;
                            saveUnits([...units, newUnit.trim()]); setNewUnit('');
                          }} className="px-2 py-1.5 bg-orange-500 text-white rounded-lg text-xs"><Plus size={12} /></button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {units.map(u => (
                            <span key={u} className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-600">
                              {u}
                              {!UNITS_DEFAULT.includes(u) && (
                                <button onClick={() => saveUnits(units.filter(x => x !== u))} className="text-gray-300 hover:text-red-400"><X size={10} /></button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">อุณหภูมิ</label>
                    <select value={addForm.temperatureType} onChange={e => setAddForm(f => ({ ...f, temperatureType: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                      <option value="normal">🌡 ธรรมดา</option>
                      <option value="cold">❄️ เย็น</option>
                      <option value="frozen">🧊 แช่แข็ง</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Min stock แจ้งเตือน</label>
                    <input type="number" value={addForm.minStock} onChange={e => setAddForm(f => ({ ...f, minStock: e.target.value }))}
                      placeholder="เช่น 5"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">คำอธิบาย (ไทย)</label>
                    <textarea value={addForm.descriptionTh} onChange={e => setAddForm(f => ({ ...f, descriptionTh: e.target.value }))}
                      placeholder="เช่น น้ำปลาแท้คุณภาพสูง ผลิตจากปลาทะเลธรรมชาติ"
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">รูปภาพ</label>
                    <ImageUploader
                      value={addForm.imageUrl}
                      onChange={url => setAddForm(f => ({ ...f, imageUrl: url }))}
                    />
                  </div>
                </div>
              </section>

              {/* ── Section 2: ราคา ── */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ราคา & กำไร</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cost */}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">ราคาทุน (ต้นทุน) ฿</label>
                    <input type="number" value={addForm.costPrice} onChange={e => setAddForm(f => ({ ...f, costPrice: e.target.value }))}
                      placeholder="เช่น 40"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                    {/* Price suggestions */}
                    {cost > 0 && (
                      <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5">
                        <p className="font-semibold text-amber-700">💡 แนะนำราคา (กดเพื่อใช้)</p>
                        <div className="space-y-1">
                          <p className="text-amber-600">ราคาส่ง (×1.5–2): {wSugg.map(v => (
                            <button key={v} onClick={() => setAddForm(f => ({ ...f, wholesalePrice: String(v) }))}
                              className="ml-1 px-2 py-0.5 bg-white border border-amber-300 rounded hover:bg-amber-100 font-mono transition">
                              {v}฿
                            </button>
                          ))}</p>
                          <div className="flex flex-wrap gap-1">
                            {wSugg.flatMap(v => psychPrice(v)).filter((v,i,a) => a.indexOf(v) === i).map(v => (
                              <button key={v} onClick={() => setAddForm(f => ({ ...f, wholesalePrice: String(v) }))}
                                className="px-2 py-0.5 bg-white border border-amber-200 rounded hover:bg-amber-100 text-gray-600 font-mono transition">
                                {v}฿ ✨
                              </button>
                            ))}
                          </div>
                          <p className="text-amber-600">ราคาปลีก (×2.5–3): {rSugg.map(v => (
                            <button key={v} onClick={() => setAddForm(f => ({ ...f, retailPrice: String(v) }))}
                              className="ml-1 px-2 py-0.5 bg-white border border-amber-300 rounded hover:bg-amber-100 font-mono transition">
                              {v}฿
                            </button>
                          ))}</p>
                          <div className="flex flex-wrap gap-1">
                            {rSugg.flatMap(v => psychPrice(v)).filter((v,i,a) => a.indexOf(v) === i).map(v => (
                              <button key={v} onClick={() => setAddForm(f => ({ ...f, retailPrice: String(v) }))}
                                className="px-2 py-0.5 bg-white border border-amber-200 rounded hover:bg-amber-100 text-gray-600 font-mono transition">
                                {v}฿ ✨
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Wholesale */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ราคายกแพ็ค (Pack Price) ฿</label>
                    <input type="number" value={addForm.wholesalePrice} onChange={e => setAddForm(f => ({ ...f, wholesalePrice: e.target.value }))}
                      placeholder="เช่น 60"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                    {wProfit && (
                      <p className={`text-xs mt-1 font-medium ${wProfit.amt >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        กำไร {wProfit.amt >= 0 ? '+' : ''}{wProfit.amt.toFixed(0)} ฿ ({wProfit.pct}%)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">จำนวนขั้นต่ำราคาส่ง</label>
                    <input type="number" value={addForm.minWholesaleQty} onChange={e => setAddForm(f => ({ ...f, minWholesaleQty: e.target.value }))}
                      placeholder="เช่น 6"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  {/* Retail */}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">ราคาปลีก ฿ <span className="text-red-400">*</span></label>
                    <input type="number" value={addForm.retailPrice} onChange={e => setAddForm(f => ({ ...f, retailPrice: e.target.value }))}
                      placeholder="เช่น 99"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                    {retailProfit && (
                      <p className={`text-xs mt-1 font-medium ${retailProfit.amt >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        กำไร {retailProfit.amt >= 0 ? '+' : ''}{retailProfit.amt.toFixed(0)} ฿ ({retailProfit.pct}%)
                      </p>
                    )}
                  </div>
                  {/* Promo */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">โปรฯ ซื้อ (ชิ้น)</label>
                    <input type="number" min={0} value={addForm.promoQty} onChange={e => setAddForm(f => ({ ...f, promoQty: e.target.value }))}
                      placeholder="เช่น 3"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                    <p className="text-[11px] text-gray-300 mt-1">เว้นว่าง = ไม่มีโปรฯ</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ราคาโปรฯ รวม ฿</label>
                    <input type="number" min={0} value={addForm.promoPrice} onChange={e => setAddForm(f => ({ ...f, promoPrice: e.target.value }))}
                      placeholder="เช่น 40"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                    <p className="text-[11px] text-gray-300 mt-1">ตัวอย่าง: 3 ชิ้น = 40 บาท</p>
                  </div>
                  {/* VAT */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">VAT %</label>
                    <input type="number" value={addForm.vatRate} onChange={e => setAddForm(f => ({ ...f, vatRate: e.target.value }))}
                      placeholder="เช่น 7"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  {/* Units conversion */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">หน่วยส่ง (wholesale unit)</label>
                    <input value={addForm.wholesaleUnit} onChange={e => setAddForm(f => ({ ...f, wholesaleUnit: e.target.value }))}
                      placeholder="เช่น ลัง"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">หน่วยฐาน (base unit)</label>
                    <input value={addForm.baseUnit} onChange={e => setAddForm(f => ({ ...f, baseUnit: e.target.value }))}
                      placeholder="เช่น ขวด"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">อัตราแปลง (1 ลัง = ? ขวด)</label>
                    <input type="number" value={addForm.conversionFactor} onChange={e => setAddForm(f => ({ ...f, conversionFactor: e.target.value }))}
                      placeholder="เช่น 12"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                </div>
              </section>

              {/* ── Section 3: ตำแหน่ง/คลัง ── */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ตำแหน่ง & คลัง</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Location picker */}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">ตำแหน่งจัดเก็บ (Location)</label>
                    <div className="flex gap-2">
                      <input readOnly value={addForm.locationCode}
                        placeholder="เช่น A-01-02-03 (โซน-ทางเดิน-ชั้น-ช่อง)"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-pointer"
                        onClick={() => setShowLocationModal(true)} />
                      <button type="button" onClick={() => setShowLocationModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-orange-400 hover:text-orange-500 transition">
                        <MapPin size={14} /> เลือก
                      </button>
                      {addForm.locationCode && (
                        <button type="button" onClick={() => setAddForm(f => ({ ...f, locationCode: '' }))}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-gray-400 hover:text-red-400 transition">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {/* Location Modal */}
                    {showLocationModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-orange-500" />
                              <h4 className="font-semibold text-gray-900 text-sm">เลือกตำแหน่งจัดเก็บ</h4>
                            </div>
                            <button onClick={() => setShowLocationModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                          </div>
                          <div className="px-5 py-3 border-b border-gray-100">
                            <input value={locationSearch} onChange={e => setLocationSearch(e.target.value)}
                              placeholder="ค้นหา เช่น A-01 หรือ โซน A"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                          </div>
                          <div className="max-h-72 overflow-y-auto px-5 py-3 space-y-1">
                            {filteredLocs.length === 0 ? (
                              <p className="text-sm text-gray-300 text-center py-8">ไม่พบตำแหน่ง</p>
                            ) : filteredLocs.map(l => (
                              <button key={l.id} onClick={() => {
                                setAddForm(f => ({ ...f, locationCode: l.fullCode }));
                                setShowLocationModal(false); setLocationSearch('');
                              }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center justify-between ${
                                  addForm.locationCode === l.fullCode ? 'bg-orange-500 text-white' : 'hover:bg-gray-50 text-gray-700'
                                }`}>
                                <span className="font-mono font-medium">{l.fullCode}</span>
                                {(l.zone || l.aisle || l.shelf || l.bin) && (
                                  <span className="text-xs opacity-60">
                                    {[l.zone && `โซน ${l.zone}`, l.aisle && `ทางเดิน ${l.aisle}`, l.shelf && `ชั้น ${l.shelf}`, l.bin && `ช่อง ${l.bin}`].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ลำดับหยิบ (pick sequence)</label>
                    <input type="number" value={addForm.pickSequence} onChange={e => setAddForm(f => ({ ...f, pickSequence: e.target.value }))}
                      placeholder="เช่น 1 (น้อย = หยิบก่อน)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Lot number</label>
                    <input value={addForm.lotNumber} onChange={e => setAddForm(f => ({ ...f, lotNumber: e.target.value }))}
                      placeholder="เช่น LOT2026-001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">วันหมดอายุ</label>
                    <input type="date" value={addForm.expiryDate} onChange={e => setAddForm(f => ({ ...f, expiryDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 text-gray-600" />
                  </div>
                  {/* Supplier */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">Supplier</label>
                      <button type="button" onClick={() => setShowSupplierModal(true)}
                        className="flex items-center gap-1 text-xs text-orange-500 hover:underline">
                        <Building2 size={11} /> เพิ่ม supplier
                      </button>
                    </div>
                    <select value={addForm.supplierId} onChange={e => setAddForm(f => ({ ...f, supplierId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                      <option value="">— ไม่ระบุ —</option>
                      {suppliers.filter(s => s.isActive !== false).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {/* Supplier Create Modal */}
                    {showSupplierModal && (
                      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <Building2 size={16} className="text-orange-500" />
                              <h4 className="font-semibold text-gray-900 text-sm">เพิ่ม Supplier</h4>
                            </div>
                            <button onClick={() => setShowSupplierModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                          </div>
                          <div className="px-5 py-4 space-y-3">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">ชื่อบริษัท / ร้าน <span className="text-red-400">*</span></label>
                              <input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="เช่น บริษัท ไทยสหพัฒน์"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">เบอร์โทร</label>
                              <input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="เช่น 02-123-4567"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">อีเมล</label>
                              <input value={supplierForm.email} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="เช่น contact@supplier.com"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">ที่อยู่</label>
                              <input value={supplierForm.address} onChange={e => setSupplierForm(f => ({ ...f, address: e.target.value }))}
                                placeholder="เช่น 123 ถ.สุขุมวิท กรุงเทพ"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                            </div>
                            <button onClick={handleCreateSupplier} disabled={isCreatingSupplier}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
                              {isCreatingSupplier ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                              บันทึก supplier
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Actions ── */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => (editProductId ? handleUpdate(editProductId) : handleAdd())}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-sm transition">
                  {editProductId ? 'บันทึกการแก้ไข' : 'บันทึกสินค้า'}
                </button>
                <button onClick={resetProductForm}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium text-sm transition">
                  ยกเลิก
                </button>
              </div>
            </div>
          );
        })()}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สินค้า</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">หมวด</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ปลีก</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ส่ง</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สต็อค</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะ</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">จัดการ</th>
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
              ) : products.map((p) => (
                <Fragment key={p.id as string}>
                  <tr className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-800">{p.nameTh as string}</div>
                      {!!p.nameZh && <div className="text-xs text-gray-400 mt-0.5">{p.nameZh as string}</div>}
                      <div className="flex items-center gap-2 mt-0.5">
                        {!!p.barcode && <span className="text-xs text-gray-300 font-mono">{p.barcode as string}</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TEMP_STYLE[p.temperatureType as string] || 'bg-gray-100 text-gray-400'}`}>
                          {TEMP_LABEL[p.temperatureType as string] || '-'}
                        </span>
                        {!!p.unit && <span className="text-xs text-gray-400">/{p.unit as string}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-gray-500">
                      {getCategoryName(p.categoryId) || <span className="text-gray-200">—</span>}
                    </td>
                    <td className="text-right px-4 py-3.5">
                      <span className="font-semibold text-gray-800">{Number(p.retailPrice).toLocaleString()} ฿</span>
                    </td>
                    <td className="text-right px-4 py-3.5 text-blue-400 text-xs">
                      {p.wholesalePrice != null ? `${Number(p.wholesalePrice).toLocaleString()} ฿` : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="text-center px-4 py-3.5">
                      <span className={`font-bold text-sm ${p.currentStock === 0 ? 'text-red-500' : Number(p.currentStock) <= Number(p.minStock) ? 'text-amber-500' : 'text-gray-700'}`}>
                        {p.currentStock as number}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3.5">
                      {p.isApproved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <Check size={11} /> อนุมัติ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                          <Clock size={11} /> รอ
                        </span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3.5">
                      <div className="flex gap-1.5 justify-center">
                        {role === 'owner' && (
                          <button
                            onClick={() => openEditProduct(p)}
                            className={`px-2.5 py-1 rounded-lg text-xs transition flex items-center gap-1 ${
                              editProductId === p.id as string ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            <Pencil size={11} /> แก้ไข
                          </button>
                        )}
                        {!p.isApproved && ['owner', 'manager'].includes(role) && (
                          <button onClick={() => handleApprove(p.id as string)}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs transition">
                            อนุมัติ
                          </button>
                        )}
                        {role === 'owner' && (
                          <button
                            onClick={() => {
                              if (editPriceId === p.id as string) {
                                setEditPriceId(null);
                              } else {
                                setEditPriceId(p.id as string);
                                setPriceForm({
                                  retailPrice: String(p.retailPrice),
                                  wholesalePrice: String(p.wholesalePrice || ''),
                                  costPrice: String(p.costPrice || ''),
                                });
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs transition ${editPriceId === p.id as string ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                            ราคา
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenLocationEditor(p.id as string)}
                          className={`px-2.5 py-1 rounded-lg text-xs transition flex items-center gap-1 ${editLocationId === p.id as string ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                          <MapPin size={11} /> ตำแหน่ง
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Inline location editor row */}
                  {editLocationId === p.id as string && (
                    <tr key={`${p.id}-loc`} className="border-t border-blue-100 bg-blue-50/30">
                      <td colSpan={7} className="px-5 py-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin size={13} className="text-blue-500" />
                            <span className="text-xs font-semibold text-blue-700">ตำแหน่งจัดเก็บ</span>
                          </div>
                          {locationRows.length === 0 && (
                            <p className="text-xs text-gray-400">ยังไม่มีตำแหน่ง — ตำแหน่งจะถูกจัดการผ่านการรับสินค้าหรือระบบ WMS</p>
                          )}
                          {locationRows.map((row, idx) => (
                            <div key={row.locationId} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-24 truncate font-mono">{row.fullCode}</span>
                              <label className="text-xs text-gray-400">จำนวน</label>
                              <input type="number" min={0} value={row.quantity}
                                onChange={e => setLocationRows(r => r.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))}
                                className="w-20 border border-blue-200 rounded-lg px-2 py-1 text-sm text-right outline-none focus:border-blue-400" />
                              <label className="text-xs text-gray-400">ลำดับ</label>
                              <input type="number" min={1} value={row.priority}
                                onChange={e => setLocationRows(r => r.map((x, i) => i === idx ? { ...x, priority: Number(e.target.value) } : x))}
                                className="w-16 border border-blue-200 rounded-lg px-2 py-1 text-sm text-right outline-none focus:border-blue-400" />
                            </div>
                          ))}
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => handleSaveLocations(p.id as string)}
                              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition">
                              บันทึก
                            </button>
                            <button onClick={() => setEditLocationId(null)}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition">
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Inline price edit row */}
                  {editPriceId === p.id as string && (
                    <tr key={`${p.id}-price`} className="border-t border-orange-100 bg-orange-50/40">
                      <td colSpan={7} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-500 w-20 shrink-0">แก้ไขราคา</span>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500">ปลีก</label>
                            <input type="number" value={priceForm.retailPrice}
                              onChange={e => setPriceForm(f => ({ ...f, retailPrice: e.target.value }))}
                              className="w-24 border border-orange-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-orange-500" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500">ส่ง</label>
                            <input type="number" value={priceForm.wholesalePrice}
                              onChange={e => setPriceForm(f => ({ ...f, wholesalePrice: e.target.value }))}
                              placeholder="—"
                              className="w-24 border border-orange-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-orange-500" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500">ทุน</label>
                            <input type="number" value={priceForm.costPrice}
                              onChange={e => setPriceForm(f => ({ ...f, costPrice: e.target.value }))}
                              placeholder="—"
                              className="w-24 border border-orange-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-orange-500" />
                          </div>
                          <button onClick={() => handleUpdatePrice(p.id as string)}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition">
                            บันทึก
                          </button>
                          <button onClick={() => setEditPriceId(null)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition">
                            ยกเลิก
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
