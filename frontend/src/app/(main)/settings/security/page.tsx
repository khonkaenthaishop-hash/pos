'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';

interface SecuritySettings {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChar: boolean;
  passwordExpiryDays: number;
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  enable2fa: boolean;
  twoFaMethod: string;
  enableIpWhitelist: boolean;
  allowedIps: string;
}

const DEFAULTS: SecuritySettings = {
  passwordMinLength: 8,
  requireUppercase: false,
  requireNumbers: true,
  requireSpecialChar: false,
  passwordExpiryDays: 0,
  sessionTimeoutMinutes: 0,
  maxConcurrentSessions: 3,
  enable2fa: false,
  twoFaMethod: 'totp',
  enableIpWhitelist: false,
  allowedIps: '',
};

export default function SecuritySettingsPage() {
  const { data, isLoading, save } = useSettings<SecuritySettings>('security');
  const { register, handleSubmit, reset, watch, formState: { isDirty, isSubmitting } } = useForm<SecuritySettings>({
    defaultValues: DEFAULTS,
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const enableIpWhitelist = watch('enableIpWhitelist');
  const enable2fa = watch('enable2fa');

  useEffect(() => {
    if (data) {
      const d = { ...DEFAULTS, ...data };
      if (Array.isArray(d.allowedIps)) (d as any).allowedIps = (d.allowedIps as unknown as string[]).join('\n');
      reset(d);
    }
  }, [data, reset]);

  const onSubmit = async (values: SecuritySettings) => {
    const payload: any = { ...values };
    if (typeof payload.allowedIps === 'string') {
      payload.allowedIps = payload.allowedIps.split('\n').map((s: string) => s.trim()).filter(Boolean);
    }
    const ok = await save(payload);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="ความปลอดภัย" description="รหัสผ่าน เซสชัน 2FA และ IP Whitelist">
        <SettingSection title="รหัสผ่าน">
          <FieldRow label="ความยาวขั้นต่ำ">
            <input {...register('passwordMinLength', { valueAsNumber: true, min: 4, max: 72 })}
              type="number" min={4} max={72}
              className="w-24 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
          <FieldRow label="ความซับซ้อน">
            {[
              { name: 'requireUppercase' as const,   label: 'ต้องมีอักษรตัวพิมพ์ใหญ่' },
              { name: 'requireNumbers' as const,     label: 'ต้องมีตัวเลข' },
              { name: 'requireSpecialChar' as const, label: 'ต้องมีอักขระพิเศษ (!@#$...)' },
            ].map(({ name, label }) => (
              <label key={name} className="flex items-center gap-3 cursor-pointer py-1">
                <input type="checkbox" {...register(name)} className="accent-orange-500 w-4 h-4" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </FieldRow>
          <FieldRow label="หมดอายุทุก (วัน)" hint="0 = ไม่มีวันหมดอายุ">
            <input {...register('passwordExpiryDays', { valueAsNumber: true, min: 0 })}
              type="number" min={0}
              className="w-28 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
        </SettingSection>

        <SettingSection title="เซสชัน">
          <FieldRow label="หมดเวลา (นาที)" hint="0 = ไม่มีการ timeout">
            <input {...register('sessionTimeoutMinutes', { valueAsNumber: true, min: 0 })}
              type="number" min={0}
              className="w-28 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
          <FieldRow label="จำนวนเซสชันพร้อมกันสูงสุด">
            <input {...register('maxConcurrentSessions', { valueAsNumber: true, min: 1 })}
              type="number" min={1}
              className="w-28 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
        </SettingSection>

        <SettingSection title="Two-Factor Authentication">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enable2fa')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">เปิดใช้งาน 2FA</span>
          </label>
          {enable2fa && (
            <FieldRow label="วิธีการ 2FA">
              <select {...register('twoFaMethod')} className="w-48 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="totp">TOTP (Authenticator App)</option>
                <option value="sms">SMS</option>
              </select>
            </FieldRow>
          )}
        </SettingSection>

        <SettingSection title="IP Whitelist">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enableIpWhitelist')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">จำกัดการเข้าถึงตาม IP</span>
          </label>
          {enableIpWhitelist && (
            <FieldRow label="IP ที่อนุญาต (CIDR)" hint="1 รายการต่อบรรทัด เช่น 192.168.1.0/24">
              <textarea {...register('allowedIps')} rows={4} placeholder={'192.168.1.0/24\n10.0.0.1'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </FieldRow>
          )}
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
