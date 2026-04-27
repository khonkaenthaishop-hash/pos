'use client';
// Re-use the existing users management page content
// This page embeds the /users functionality inside the settings layout

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, UserCheck, UserX, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '@/lib/api';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';

interface User {
  id: string;
  username: string;
  role: string;
  nameTh: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'เจ้าของ',
  manager: 'ผู้จัดการ',
  cashier: 'แคชเชียร์',
  staff: 'พนักงาน',
  admin: 'แอดมิน',
  readonly: 'ดูอย่างเดียว',
};

export default function UsersSettingsPage() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, string>)?.role;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'cashier', nameTh: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await usersApi.list();
      setUsers(res.data);
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.username || !form.password) return;
    setSaving(true);
    try {
      await usersApi.create(form as any);
      toast.success('เพิ่มผู้ใช้งานแล้ว');
      setShowAdd(false);
      setForm({ username: '', password: '', role: 'cashier', nameTh: '' });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'เพิ่มผู้ใช้ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (user: User) => {
    try {
      if (user.isActive) {
        await usersApi.deactivate(user.id);
        toast.success('ปิดใช้งานแล้ว');
      } else {
        await usersApi.activate(user.id);
        toast.success('เปิดใช้งานแล้ว');
      }
      load();
    } catch {
      toast.error('ไม่สำเร็จ');
    }
  };

  if (loading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <SettingsPageShell title="ผู้ใช้งาน" description="จัดการบัญชีผู้ใช้ในระบบ">
      {role === 'owner' && (
        <div className="mb-4">
          {showAdd ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">เพิ่มผู้ใช้ใหม่</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Username *</label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="username" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">ชื่อ (ไทย)</label>
                  <input value={form.nameTh} onChange={e => setForm(f => ({ ...f, nameTh: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div className="relative">
                  <label className="text-xs font-medium text-slate-600 block mb-1">รหัสผ่าน *</label>
                  <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    type={showPw ? 'text' : 'password'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-8 text-slate-400">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">บทบาท</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'owner').map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">ยกเลิก</button>
                <button onClick={handleAdd} disabled={saving} className="px-5 py-2 text-sm bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50">
                  {saving ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 active:scale-95 transition">
              <Plus size={16} /> เพิ่มผู้ใช้งาน
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ผู้ใช้</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">บทบาท</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">สถานะ</th>
              {role === 'owner' && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{u.username}</div>
                  {u.nameTh && <div className="text-xs text-slate-400">{u.nameTh}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </td>
                {role === 'owner' && (
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggle(u)} title={u.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                      {u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsPageShell>
  );
}
