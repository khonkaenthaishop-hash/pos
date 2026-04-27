'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { customersApi } from '@/lib/api';
import { Copy, Loader2, Pencil, Plus, Save, Search, Trash2, Users, X } from 'lucide-react';

type Customer = Record<string, unknown> & {
  id: string;
  name?: string | null;
  nickname?: string | null;
  phone?: string | null;
  lineId?: string | null;
  facebookId?: string | null;
  totalOrders?: number | null;
  totalSpent?: number | null;
  note?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    phone: '',
    lineId: '',
    facebookId: '',
    note: '',
    isActive: true,
  });

  const load = async (q?: string) => {
    setIsLoading(true);
    try {
      const res = await customersApi.list(q, 1, 200);
      const data = res.data as unknown;
      const items = Array.isArray(data)
        ? data
        : (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).items))
          ? ((data as Record<string, unknown>).items as unknown[])
          : [];
      setCustomers(items as Customer[]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'โหลดลูกค้าไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(search.trim() || undefined);
    setSelected(null);
  };

  const openDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await customersApi.byId(id);
      const detail = res.data as Customer;
      setSelected(detail);
      setIsEditing(false);
      setForm({
        name: String(detail.name || ''),
        nickname: String(detail.nickname || ''),
        phone: String(detail.phone || ''),
        lineId: String(detail.lineId || ''),
        facebookId: String(detail.facebookId || ''),
        note: String(detail.note || ''),
        isActive: detail.isActive !== false,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const copy = async (text?: string | null) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  const startAdd = () => {
    setShowAdd(true);
    setIsEditing(false);
    setSelected(null);
    setForm({
      name: '',
      nickname: '',
      phone: '',
      lineId: '',
      facebookId: '',
      note: '',
      isActive: true,
    });
  };

  const handleCreate = async () => {
    if (!form.name.trim() && !form.phone.trim()) {
      toast.error('กรุณากรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง');
      return;
    }
    setIsSaving(true);
    try {
      await customersApi.create({
        name: form.name || null,
        nickname: form.nickname || null,
        phone: form.phone || null,
        lineId: form.lineId || null,
        facebookId: form.facebookId || null,
        note: form.note || null,
        isActive: form.isActive,
      });
      toast.success('เพิ่มลูกค้าแล้ว');
      setShowAdd(false);
      await load(search.trim() || undefined);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เพิ่มลูกค้าไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setIsSaving(true);
    try {
      await customersApi.update(selected.id, {
        name: form.name || null,
        nickname: form.nickname || null,
        phone: form.phone || null,
        lineId: form.lineId || null,
        facebookId: form.facebookId || null,
        note: form.note || null,
        isActive: form.isActive,
      });
      toast.success('บันทึกแล้ว');
      setIsEditing(false);
      await openDetail(selected.id);
      await load(search.trim() || undefined);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected?.id) return;
    if (!confirm(`ลบลูกค้า "${selected.name || selected.nickname || selected.phone || selected.id}" ?\nการลบจะถาวร`)) return;
    setIsDeleting(true);
    try {
      await customersApi.remove(selected.id);
      toast.success('ลบแล้ว');
      setSelected(null);
      setIsEditing(false);
      await load(search.trim() || undefined);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ลบไม่สำเร็จ');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-gray-400" />
              <h1 className="text-lg font-bold text-gray-900">ลูกค้า</h1>
              <span className="text-xs text-gray-400 mt-0.5">{customers.length} รายการ</span>
            </div>
            <button
              onClick={startAdd}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition"
            >
              <Plus size={16} /> เพิ่มลูกค้า
            </button>
          </div>
        </div>

        <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ/ชื่อเล่น/เบอร์..."
                className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm transition"
            >
              ค้นหา
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="py-16 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
              </div>
            ) : customers.length === 0 ? (
              <div className="py-16 text-center text-gray-300 text-sm">ไม่พบลูกค้า</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ลูกค้า</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">ติดต่อ</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">ออร์เดอร์</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const name = c.name || c.nickname || '—';
                    const active = c.isActive !== false;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => openDetail(c.id)}
                        className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-gray-800">{name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {c.nickname ? `ชื่อเล่น: ${c.nickname}` : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-gray-700 font-mono">{c.phone || '—'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{c.lineId ? `LINE: ${c.lineId}` : '—'}</div>
                        </td>
                        <td className="text-right px-4 py-3.5 text-xs text-gray-600 tabular-nums">{Number(c.totalOrders || 0)}</td>
                        <td className="text-right px-4 py-3.5 font-semibold text-gray-800 tabular-nums">
                          {Number(c.totalSpent || 0).toLocaleString()} ฿
                          {!active && <span className="ml-2 text-xs text-gray-300">(inactive)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-base">{showAdd ? 'เพิ่มลูกค้า' : 'รายละเอียดลูกค้า'}</h2>
          {(selected || showAdd) && (
            <button
              onClick={() => { setShowAdd(false); setIsEditing(false); }}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"
              title="ปิด"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {isLoadingDetail ? (
            <div className="py-8 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : showAdd ? (
            <div className="space-y-3">
              {([['name','ชื่อ'],['nickname','ชื่อเล่น'],['phone','โทร'],['lineId','LINE'],['facebookId','Facebook']] as const).map(([k,label]) => (
                <div key={k}>
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <input
                    value={form[k]}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                </div>
              ))}
              <div>
                <div className="text-xs text-gray-400 mb-1">หมายเหตุ</div>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
              <button
                onClick={handleCreate}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-950 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                บันทึก
              </button>
            </div>
          ) : !selected ? (
            <div className="py-8 text-sm text-gray-300">เลือกแถวในตารางเพื่อดูรายละเอียด</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(v => !v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-semibold transition"
                >
                  <Pencil size={14} /> {isEditing ? 'ยกเลิกแก้ไข' : 'แก้ไข'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-11 flex items-center justify-center py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-xl transition"
                  title="ลบ"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>

              <div>
                <div className="text-xs text-gray-400">ชื่อ</div>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="ชื่อ" className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
                    <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                      placeholder="ชื่อเล่น" className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-gray-900">{selected.name || '—'}</div>
                    {selected.nickname && <div className="text-xs text-gray-500 mt-0.5">ชื่อเล่น: {selected.nickname}</div>}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400">โทร</div>
                    {isEditing ? (
                      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono" />
                    ) : (
                      <div className="text-sm font-mono text-gray-900 truncate">{selected.phone || '—'}</div>
                    )}
                  </div>
                  {selected.phone && (
                    <button onClick={() => copy(selected.phone)} className="text-gray-300 hover:text-gray-600 transition" title="คัดลอก">
                      <Copy size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400">LINE</div>
                    {isEditing ? (
                      <input value={form.lineId} onChange={e => setForm(f => ({ ...f, lineId: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono" />
                    ) : (
                      <div className="text-sm font-mono text-gray-900 truncate">{selected.lineId || '—'}</div>
                    )}
                  </div>
                  {selected.lineId && (
                    <button onClick={() => copy(selected.lineId)} className="text-gray-300 hover:text-gray-600 transition" title="คัดลอก">
                      <Copy size={14} />
                    </button>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-400">Facebook</div>
                  {isEditing ? (
                    <input value={form.facebookId} onChange={e => setForm(f => ({ ...f, facebookId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono" />
                  ) : (
                    <div className="text-sm font-mono text-gray-900">{selected.facebookId || '—'}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-400">ออร์เดอร์</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">{Number(selected.totalOrders || 0)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-400">ยอดรวม</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">{Number(selected.totalSpent || 0).toLocaleString()} ฿</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">หมายเหตุ</div>
                {isEditing ? (
                  <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none" />
                ) : (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{selected.note || '—'}</div>
                )}
              </div>

              {isEditing && (
                <>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                    Active
                  </label>
                  <button
                    onClick={handleUpdate}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-950 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    บันทึก
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
