'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';

const FEATURES = [
  { key: 'pos',        label: 'POS ขายหน้าร้าน' },
  { key: 'orders',     label: 'ออเดอร์ออนไลน์' },
  { key: 'products',   label: 'จัดการสินค้า' },
  { key: 'categories', label: 'หมวดหมู่' },
  { key: 'inventory',  label: 'คลัง / สต็อก' },
  { key: 'shipments',  label: 'จัดส่ง' },
  { key: 'customers',  label: 'ลูกค้า' },
  { key: 'reports',    label: 'รายงาน' },
  { key: 'audit',      label: 'Audit Log' },
  { key: 'settings',   label: 'ตั้งค่า' },
];

const ROLES = ['manager', 'cashier', 'staff', 'admin', 'readonly'] as const;
const ROLE_LABELS: Record<string, string> = {
  manager: 'ผู้จัดการ',
  cashier: 'แคชเชียร์',
  staff:   'พนักงาน',
  admin:   'แอดมิน',
  readonly:'ดูอย่างเดียว',
};

type PermsMatrix = Record<string, Record<string, { read: boolean; write: boolean }>>;

function buildDefault(): PermsMatrix {
  const m: PermsMatrix = {};
  for (const f of FEATURES) {
    m[f.key] = {};
    for (const r of ROLES) {
      m[f.key][r] = { read: true, write: r === 'manager' };
    }
  }
  return m;
}

export default function RolesSettingsPage() {
  const { data, isLoading, save } = useSettings<PermsMatrix>('roles-perms');
  const { register, handleSubmit, reset, formState: { isDirty, isSubmitting } } = useForm<PermsMatrix>({
    defaultValues: buildDefault(),
  });

  useEffect(() => {
    if (data && Object.keys(data).length) reset(data as any);
  }, [data, reset]);

  const onSubmit = async (values: PermsMatrix) => {
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="สิทธิ์การใช้งาน" description="กำหนดสิทธิ์ของแต่ละบทบาท (เจ้าของร้านมีสิทธิ์เต็มเสมอ)">
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-40">ฟีเจอร์</th>
                {ROLES.map(r => (
                  <th key={r} className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase" colSpan={2}>
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <th />
                {ROLES.map(r => (
                  <>
                    <th key={`${r}-r`} className="text-center px-2 py-1 text-xs text-slate-400">ดู</th>
                    <th key={`${r}-w`} className="text-center px-2 py-1 text-xs text-slate-400">แก้ไข</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FEATURES.map(f => (
                <tr key={f.key} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{f.label}</td>
                  {ROLES.map(r => (
                    <>
                      <td key={`${r}-r`} className="text-center px-2 py-3">
                        <input type="checkbox" {...register(`${f.key}.${r}.read` as any)} className="accent-orange-500 w-4 h-4" />
                      </td>
                      <td key={`${r}-w`} className="text-center px-2 py-3">
                        <input type="checkbox" {...register(`${f.key}.${r}.write` as any)} className="accent-orange-500 w-4 h-4" />
                      </td>
                    </>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">* สิทธิ์เหล่านี้ใช้สำหรับการแสดงผล UI ส่วน backend ยังใช้ role guard</p>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset(data as any ?? buildDefault())} />
    </form>
  );
}
