'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { usersApi } from '@/lib/api';
import { CheckCircle, KeyRound, Loader2, Pencil, UserCheck, UserPlus, Users, UserX, X } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageProvider';

type User = Record<string, unknown> & {
  id: string;
  username: string;
  role: string;
  nameTh?: string | null;
  nameEn?: string | null;
  nameZh?: string | null;
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

function passwordStrength(
  pw: string,
  t: (key: string) => string,
): { label: string; color: string } {
  if (pw.length === 0) return { label: '', color: '' };
  if (pw.length < 8)   return { label: t('users.pw_weak'), color: 'text-red-500' };
  if (pw.length < 12)  return { label: t('users.pw_ok'), color: 'text-amber-500' };
  return { label: t('users.pw_strong'), color: 'text-emerald-600' };
}

export default function UsersPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as Record<string, string> | undefined)?.id || '';
  const currentRole = (session?.user as Record<string, string> | undefined)?.role || '';
  const { t } = useLanguage();

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
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    role: 'staff',
    nameTh: '',
    nameEn: '',
    nameZh: '',
    phone: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const pwStrength = passwordStrength(form.password, t);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.list();
      setUsers((res.data || []) as User[]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || t('users.load_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeCount = useMemo(() => users.filter(u => u.isActive !== false).length, [users]);

  const handleCreate = async () => {
    if (!form.username.trim()) { toast.error(t('users.err_username_required')); return; }
    if (form.password.length < 8) { toast.error(t('users.err_password_min')); return; }
    setIsCreating(true);
    try {
      await usersApi.create({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        nameTh: form.nameTh || undefined,
        phone: form.phone || undefined,
      });
      toast.success(t('users.created'));
      setShowAdd(false);
      setForm({ username: '', password: '', role: 'staff', nameTh: '', phone: '' });
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || t('users.create_failed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivate = async (u: User) => {
    if (u.id === currentUserId) { toast.error(t('users.err_deactivate_self')); return; }
    if (!confirm(`${t('users.deactivate_confirm')} "${u.nameTh || u.username}"?`)) return;
    setBusyId(u.id);
    try {
      await usersApi.deactivate(u.id);
      toast.success(t('users.deactivated'));
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || t('common.action_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleActivate = async (u: User) => {
    if (!confirm(`${t('users.activate_confirm')} "${u.nameTh || u.username}"?`)) return;
    setBusyId(u.id);
    try {
      await usersApi.activate(u.id);
      toast.success(t('users.activated'));
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || t('common.action_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({
      username: String(u.username || ''),
      role: String(u.role || 'staff'),
      nameTh: String(u.nameTh || ''),
      nameEn: String(u.nameEn || ''),
      nameZh: String(u.nameZh || ''),
      phone: String(u.phone || ''),
    });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    if (!editForm.username.trim()) { toast.error(t('users.err_username_required')); return; }
    setIsSavingEdit(true);
    try {
      await usersApi.update(editUser.id, {
        username: editForm.username.trim(),
        role: editForm.role,
        nameTh: editForm.nameTh.trim() || null,
        nameEn: editForm.nameEn.trim() || null,
        nameZh: editForm.nameZh.trim() || null,
        phone: editForm.phone.trim() || null,
      });
      toast.success(t('common.saved'));
      setEditUser(null);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || t('common.save_failed'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openResetPassword = (u: User) => {
    setResetUser(u);
    setResetPassword('');
    setTempPassword(null);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetUser.id === currentUserId) { toast.error(t('users.err_reset_self')); return; }
    if (resetPassword && resetPassword.length < 8) { toast.error(t('users.err_password_min')); return; }
    setIsResetting(true);
    try {
      const res = await usersApi.resetPassword(resetUser.id, resetPassword ? { password: resetPassword } : {});
      const pw = String((res.data as { tempPassword?: string }).tempPassword || '');
      setTempPassword(pw || null);
      if (pw) {
        await navigator.clipboard.writeText(pw).catch(() => {});
        toast.success(t('users.reset_done_copied'));
      } else {
        toast.success(t('users.reset_done'));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || t('users.reset_failed'));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users size={18} className="text-gray-400" />
          <h1 className="text-lg font-bold text-gray-900">{t('users.title')}</h1>
          <span className="text-xs text-gray-400 mt-0.5">{activeCount}/{users.length} active</span>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition"
        >
          <UserPlus size={16} />
          {t('users.add')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {showAdd && (
          <div className="bg-white rounded-xl border-2 border-orange-300 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">{t('users.create_title')}</h3>
              <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600">{t('common.close')}</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder={t('users.username_placeholder')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <div className="space-y-1">
                <input
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={t('users.password_placeholder')}
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
                placeholder={t('users.phone_placeholder')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <input
                value={form.nameTh}
                onChange={e => setForm(f => ({ ...f, nameTh: e.target.value }))}
                placeholder={t('users.name_th_placeholder')}
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
                {t('common.save')}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" /> {t('common.loading')}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-gray-300 text-sm">{t('users.empty')}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('users.th_user')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">{t('users.status')}</th>
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
                          {isSelf && <span className="ml-2 text-xs text-orange-500 font-normal">({t('users.you')})</span>}
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
                        <div className="space-y-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
                          >
                            <Pencil size={14} />
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => openResetPassword(u)}
                            disabled={isSelf || currentRole !== 'owner'}
                            title={currentRole !== 'owner' ? t('common.owner_only') : (isSelf ? t('users.err_reset_self') : undefined)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-700 rounded-lg text-xs font-semibold transition"
                          >
                            <KeyRound size={14} />
                            {t('users.reset_password')}
                          </button>
                          {active ? (
                            <button
                              onClick={() => handleDeactivate(u)}
                              disabled={busy || isSelf || currentRole !== 'owner'}
                              title={
                                isSelf
                                  ? t('users.err_deactivate_self')
                                  : currentRole !== 'owner'
                                    ? t('common.owner_only')
                                    : undefined
                              }
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-600 rounded-lg text-xs font-semibold transition"
                            >
                              {busy ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                              {t('users.deactivate')}
                            </button>
                          ) : (
                          <button
                            onClick={() => handleActivate(u)}
                            disabled={busy || currentRole !== 'owner'}
                            title={currentRole !== 'owner' ? t('common.owner_only') : undefined}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-600 rounded-lg text-xs font-semibold transition"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                            {t('users.activate')}
                          </button>
                        )}
                        </div>
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
            {t('users.inactive_hint')}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-900">{t('users.edit_title')}</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">{editUser.username}</div>
              </div>
              <button onClick={() => setEditUser(null)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500">Username</label>
                <input
                  value={editForm.username}
                  onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                  disabled={currentRole !== 'owner'}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 disabled:bg-gray-50"
                />
                {currentRole !== 'owner' && (
                  <div className="text-[11px] text-gray-400 mt-1">{t('common.owner_only')}</div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Role</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  disabled={currentRole !== 'owner'}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white disabled:bg-gray-50"
                >
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500">{t('users.name_th')}</label>
                <input
                  value={editForm.nameTh}
                  onChange={e => setEditForm(f => ({ ...f, nameTh: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500">{t('users.name_en')}</label>
                <input
                  value={editForm.nameEn}
                  onChange={e => setEditForm(f => ({ ...f, nameEn: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500">{t('users.name_zh')}</label>
                <input
                  value={editForm.nameZh}
                  onChange={e => setEditForm(f => ({ ...f, nameZh: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-950 disabled:opacity-60 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900">{t('users.reset_password')}</div>
              <button onClick={() => setResetUser(null)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm text-gray-600">
                {t('users.th_user')}: <span className="font-semibold text-gray-900">{resetUser.nameTh || resetUser.username}</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">{t('users.new_password_optional')}</label>
                <input
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  type="password"
                  placeholder={t('users.password_min_placeholder')}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
              </div>
              {tempPassword && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-3 text-sm">
                  <div className="text-xs text-emerald-700 font-semibold">{t('users.new_password_copied')}</div>
                  <div className="mt-1 font-mono text-emerald-800">{tempPassword}</div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setResetUser(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">
                {t('common.close')}
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isResetting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                {isResetting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {t('users.confirm_reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
