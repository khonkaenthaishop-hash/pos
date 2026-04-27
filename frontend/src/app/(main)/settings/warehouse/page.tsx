'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi } from '@/lib/api';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { WarehouseModal } from '@/components/settings/WarehouseModal';

interface Warehouse {
  id: string;
  name: string;
  zone?: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function WarehouseSettingsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await settingsApi.listWarehouses();
      setWarehouses(res.data);
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (wh: Warehouse) => {
    if (!confirm(`ลบคลัง "${wh.name}" ?`)) return;
    try {
      await settingsApi.deleteWarehouse(wh.id);
      toast.success('ลบแล้ว');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  if (loading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <SettingsPageShell title="คลังสินค้า" description="จัดการคลังและโซนจัดเก็บสินค้า">
      <div className="mb-4">
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 active:scale-95 transition"
        >
          <Plus size={16} /> เพิ่มคลังสินค้า
        </button>
      </div>

      <div className="space-y-3">
        {warehouses.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
            ยังไม่มีคลังสินค้า กดเพิ่มด้านบน
          </div>
        )}
        {warehouses.map(wh => (
          <div key={wh.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${!wh.isActive ? 'opacity-50 border-slate-200' : 'border-slate-200'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{wh.name}</span>
                {wh.isDefault && (
                  <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                    <Star size={10} /> ค่าเริ่มต้น
                  </span>
                )}
                {!wh.isActive && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">ปิดใช้งาน</span>
                )}
              </div>
              {wh.zone && <div className="text-xs text-slate-500 mt-0.5">โซน: {wh.zone}</div>}
              {wh.address && <div className="text-xs text-slate-400 mt-0.5 truncate">{wh.address}</div>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setEditing(wh); setShowModal(true); }}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => handleDelete(wh)}
                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <WarehouseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        warehouse={editing}
        onSaved={load}
      />
    </SettingsPageShell>
  );
}
