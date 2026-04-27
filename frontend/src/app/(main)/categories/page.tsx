'use client';
import { Fragment, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { categoriesApi } from '@/lib/api';
import { useSession } from 'next-auth/react';
import { FolderPlus, Loader2, Tag, Search, Pencil, Trash2, Check, X } from 'lucide-react';

type Category = {
  id: string;
  nameTh: string;
  nameZh?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  sortOrder?: number | null;
  type?: string | null;
  isActive?: boolean;
};

const CATEGORY_TYPES = [
  { value: 'product',  label: 'สินค้า' },
  { value: 'service',  label: 'บริการ' },
  { value: 'online',   label: 'ออนไลน์' },
];

const emptyForm = { nameTh: '', nameZh: '', nameEn: '', icon: '', sortOrder: '0', type: 'product', isActive: true };

export default function CategoriesPage() {
  const { data: session } = useSession();
  const isOwner = (session?.user as Record<string, string> | null | undefined)?.role === 'owner';

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const load = async (q?: string) => {
    setIsLoading(true);
    try {
      const res = await categoriesApi.list(q ? { search: q } : undefined);
      setCategories((res.data || []) as Category[]);
    } catch {
      toast.error('โหลดหมวดหมู่ไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.SyntheticEvent) => {
    e.preventDefault();
    load(search);
  };

  // ── Create ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.nameTh.trim()) { toast.error('กรุณากรอกชื่อหมวดหมู่ (TH)'); return; }
    setIsCreating(true);
    try {
      await categoriesApi.create({
        nameTh: form.nameTh.trim(),
        nameZh: form.nameZh.trim() || null,
        nameEn: form.nameEn.trim() || null,
        icon: form.icon.trim() || null,
        sortOrder: Number(form.sortOrder || 0),
        type: form.type || 'product',
        isActive: form.isActive,
      });
      toast.success('เพิ่มหมวดหมู่แล้ว');
      setForm(emptyForm);
      await load(search);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เพิ่มหมวดหมู่ไม่สำเร็จ');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────
  const openEdit = (c: Category) => {
    setEditId(c.id);
    setEditForm({
      nameTh: c.nameTh || '',
      nameZh: c.nameZh || '',
      nameEn: c.nameEn || '',
      icon: c.icon || '',
      sortOrder: String(c.sortOrder ?? 0),
      type: c.type || 'product',
      isActive: c.isActive ?? true,
    });
  };

  const handleSaveEdit = async () => {
    if (!editId || !editForm.nameTh.trim()) { toast.error('กรุณากรอกชื่อหมวดหมู่'); return; }
    setIsSavingEdit(true);
    try {
      await categoriesApi.update(editId, {
        nameTh: editForm.nameTh.trim(),
        nameZh: editForm.nameZh.trim() || null,
        nameEn: editForm.nameEn.trim() || null,
        icon: editForm.icon.trim() || null,
        sortOrder: Number(editForm.sortOrder || 0),
        type: editForm.type || 'product',
        isActive: editForm.isActive,
      });
      toast.success('แก้ไขหมวดหมู่แล้ว');
      setEditId(null);
      await load(search);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'แก้ไขไม่สำเร็จ');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = async (c: Category) => {
    if (!window.confirm(`ลบหมวดหมู่ "${c.nameTh}" ใช่ไหม?\nสินค้าในหมวดนี้จะไม่มีหมวดหมู่`)) return;
    try {
      await categoriesApi.remove(c.id);
      toast.success('ลบหมวดหมู่แล้ว');
      await load(search);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center gap-2.5">
        <Tag size={18} className="text-gray-400" />
        <h1 className="text-lg font-bold text-gray-900">หมวดหมู่</h1>
        <span className="text-xs text-gray-400">{categories.length} รายการ</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาหมวดหมู่..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-orange-400 bg-white" />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm transition">ค้นหา</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); load(); }}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition">
              ล้าง
            </button>
          )}
        </form>

        {/* Create Form — owner only */}
        {isOwner && (
          <div className="bg-white rounded-xl border-2 border-orange-300 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">เพิ่มหมวดหมู่</h3>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.nameTh} onChange={e => setForm(f => ({ ...f, nameTh: e.target.value }))}
                placeholder="ชื่อ (TH) *"
                className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <input value={form.nameZh} onChange={e => setForm(f => ({ ...f, nameZh: e.target.value }))}
                placeholder="ชื่อ (ZH) (ถ้ามี)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <input value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                placeholder="ชื่อ (EN) (ถ้ามี)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="Icon emoji เช่น 🧂"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <input value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                placeholder="Sort order" type="number"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                {CATEGORY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-gray-600">เปิดใช้งาน (Active)</span>
              </label>
              <div className="flex justify-end col-span-2">
                <button onClick={handleCreate} disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-lg text-sm transition">
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <FolderPlus size={16} />}
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : categories.length === 0 ? (
            <div className="py-16 text-center text-gray-300 text-sm">ไม่พบหมวดหมู่</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">หมวดหมู่</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Sort</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">ประเภท</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">สถานะ</th>
                  {isOwner && <th className="px-4 py-3 w-24"></th>}
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <Fragment key={c.id}>
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {c.icon && <span className="text-xl leading-none">{c.icon}</span>}
                          <div>
                            <div className="font-medium text-gray-800">{c.nameTh}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {[c.nameZh, c.nameEn].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 tabular-nums">{Number(c.sortOrder || 0)}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">{CATEGORY_TYPES.find(t => t.value === c.type)?.label ?? c.type ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${(c.isActive ?? true) ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {(c.isActive ?? true) ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => editId === c.id ? setEditId(null) : openEdit(c)}
                              title="แก้ไข"
                              className={`w-7 h-7 flex items-center justify-center rounded-lg transition ${editId === c.id ? 'bg-blue-100 text-blue-600' : 'bg-blue-50 hover:bg-blue-100 text-blue-500'}`}>
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(c)}
                              title="ลบ"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {/* Inline edit row */}
                    {editId === c.id && (
                      <tr key={`${c.id}-edit`} className="border-t border-blue-100">
                        <td colSpan={isOwner ? 4 : 3} className="px-5 py-4 bg-blue-50/30">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <input value={editForm.nameTh} onChange={e => setEditForm(f => ({ ...f, nameTh: e.target.value }))}
                              placeholder="ชื่อ (TH) *"
                              className="border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                            <input value={editForm.nameZh} onChange={e => setEditForm(f => ({ ...f, nameZh: e.target.value }))}
                              placeholder="ชื่อ (ZH)"
                              className="border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                            <input value={editForm.nameEn} onChange={e => setEditForm(f => ({ ...f, nameEn: e.target.value }))}
                              placeholder="ชื่อ (EN)"
                              className="border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                            <input value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                              placeholder="Icon emoji"
                              className="border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                            <input value={editForm.sortOrder} onChange={e => setEditForm(f => ({ ...f, sortOrder: e.target.value }))}
                              placeholder="Sort order" type="number"
                              className="border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
                            <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                              className="border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white">
                              {CATEGORY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <label className="flex items-center gap-2 cursor-pointer select-none col-span-1">
                              <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                                className="w-4 h-4 accent-blue-500" />
                              <span className="text-sm text-gray-600">Active</span>
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleSaveEdit} disabled={isSavingEdit}
                              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm transition">
                              {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              บันทึก
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition">
                              <X size={14} /> ยกเลิก
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
