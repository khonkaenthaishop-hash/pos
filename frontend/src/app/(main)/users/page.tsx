'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { usersApi } from '@/lib/api';
import { CheckCircle, Loader2, UserCheck, UserPlus, Users, UserX } from 'lucide-react';

type User = Record<string, unknown> & {
  id: string;
  username: string;
  role: string;
  nameTh?: string | null;
  phone?: string | null;
  isActive?: boolean;
  createdAt?: string;
};

const ROLE_OPTIONS = [
  { value: 'owner',   label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin',   label: 'Admin' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'staff',   label: 'Staff' },
];

function passwordStrength(pw: string): { label: string; color: string } {
  if (pw.length === 0) return { label: '', color: '' };
  if (pw.length < 8)   return { label: 'อ่อนแอ (ต้องมีอย่างน้อย 8 ตัว)', color: 'text-red-500' };
  if (pw.length < 12)  return { label: 'พอใช้', color: 'text-amber-500' };
  return { label: 'แข็งแกร่ง', color: 'text-emerald-600' };
}

export default function UsersPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as Record<string, string> | undefined)?.id || '';

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'staff',
    nameTh: '',
    phone: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const pwStrength = passwordStrength(form.password);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.list();
      setUsers((res.data || []) as User[]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'โหลดผู้ใช้ไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeCount = useMemo(() => users.filter(u => u.isActive !== false).length, [users]);

  const handleCreate = async () => {
    if (!form.username.trim()) { toast.error('กรุณากรอก Username'); return; }
    if (form.password.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setIsCreating(true);
    try {
      await usersApi.create({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        nameTh: form.nameTh || undefined,
        phone: form.phone || undefined,
      });
      toast.success('สร้างผู้ใช้แล้ว');
      setShowAdd(false);
      setForm({ username: '', password: '', role: 'staff', nameTh: '', phone: '' });
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'สร้างผู้ใช้ไม่สำเร็จ');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivate = async (u: User) => {
    if (u.id === currentUserId) { toast.error('ไม่สามารถปิดใช้งานบัญชีตัวเองได้'); return; }
    if (!confirm(`ปิดใช้งาน "${u.nameTh || u.username}"?`)) return;
    setBusyId(u.id);
    try {
      await usersApi.deactivate(u.id);
      toast.success('ปิดใช้งานแล้ว');
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const handleActivate = async (u: User) => {
    if (!confirm(`เปิดใช้งาน "${u.nameTh || u.username}" อีกครั้ง?`)) return;
    setBusyId(u.id);
    try {
      await usersApi.activate(u.id);
      toast.success('เปิดใช้งานแล้ว');
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users size={18} className="text-gray-400" />
          <h1 className="text-lg font-bold text-gray-900">ผู้ใช้งาน</h1>
          <span className="text-xs text-gray-400 mt-0.5">{activeCount}/{users.length} active</span>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition"
        >
          <UserPlus size={16} />
          เพิ่มผู้ใช้
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {showAdd && (
          <div className="bg-white rounded-xl border-2 border-orange-300 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">สร้างผู้ใช้ใหม่</h3>
              <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600">ปิด</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="Username * (ตัวอักษร ตัวเลข _)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <div className="space-y-1">
                <input
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Password * (อย่างน้อย 8 ตัว)"
                  type="password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
                {pwStrength.label && (
                  <p className={`text-xs ${pwStrength.color}`}>{pwStrength.label}</p>
                )}
              </div>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
              >
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="เบอร์โทร (ถ้ามี)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <input
                value={form.nameTh}
                onChange={e => setForm(f => ({ ...f, nameTh: e.target.value }))}
                placeholder="ชื่อ (TH) (ถ้ามี)"
                className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleCreate}
                disabled={isCreating || form.password.length < 8}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-lg text-sm transition"
              >
                {isCreating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                บันทึก
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-gray-300 text-sm">ยังไม่มีผู้ใช้</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ผู้ใช้</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">สถานะ</th>
                  <th className="px-4 py-3 w-40" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const active = u.isActive !== false;
                  const busy = busyId === u.id;
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-800">
                          {u.nameTh || u.username}
                          {isSelf && <span className="ml-2 text-xs text-orange-500 font-normal">(คุณ)</span>}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{u.username}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full capitalize">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {active ? (
                          <button
                            onClick={() => handleDeactivate(u)}
                            disabled={busy || isSelf}
                            title={isSelf ? 'ไม่สามารถปิดบัญชีตัวเองได้' : undefined}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-600 rounded-lg text-xs font-semibold transition"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                            ปิดใช้งาน
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(u)}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-600 rounded-lg text-xs font-semibold transition"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                            เปิดใช้งาน
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Deactivated users notice */}
        {users.some(u => u.isActive === false) && (
          <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
            <CheckCircle size={13} className="text-emerald-400" />
            ผู้ใช้ที่ถูกปิดใช้งานสามารถเปิดใช้งานได้อีกครั้ง
          </div>
        )}
      </div>
    </div>
  );
}
