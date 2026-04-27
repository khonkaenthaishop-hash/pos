'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { MaskedInput } from '@/components/settings/MaskedInput';
import { useSettings } from '@/hooks/useSettings';

const UNCHANGED = '__UNCHANGED__';

interface NotificationSettings {
  enableLineNotify: boolean;
  lineNotifyToken: string;
  enableEmail: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  notifyLowStock: boolean;
  notifyNewOrder: boolean;
  notifyDailyReport: boolean;
  notifyShipmentUpdate: boolean;
  dailyReportTime: string;
}

const DEFAULTS: NotificationSettings = {
  enableLineNotify: false, lineNotifyToken: '',
  enableEmail: false, smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', fromEmail: '',
  notifyLowStock: true, notifyNewOrder: true, notifyDailyReport: false, notifyShipmentUpdate: false,
  dailyReportTime: '08:00',
};

export default function NotificationsSettingsPage() {
  const { data, isLoading, save } = useSettings<NotificationSettings>('notifications');
  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty, isSubmitting } } = useForm<NotificationSettings>({
    defaultValues: DEFAULTS,
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const enableLine = watch('enableLineNotify');
  const enableEmail = watch('enableEmail');

  useEffect(() => {
    if (data) {
      const d = { ...DEFAULTS, ...data };
      // Masked fields come back as '****' — keep as sentinel
      reset(d);
    }
  }, [data, reset]);

  const onSubmit = async (values: NotificationSettings) => {
    // Replace '****' with sentinel so backend skips overwriting
    const payload = { ...values };
    if (payload.lineNotifyToken === '****') payload.lineNotifyToken = UNCHANGED;
    if (payload.smtpPass === '****') payload.smtpPass = UNCHANGED;
    const ok = await save(payload as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="การแจ้งเตือน" description="LINE Notify, Email และเหตุการณ์ที่ต้องการแจ้งเตือน">
        <SettingSection title="LINE Notify">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enableLineNotify')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">เปิดการแจ้งเตือนผ่าน LINE</span>
          </label>
          {enableLine && (
            <FieldRow label="LINE Notify Token" hint="สร้างได้ที่ notify-bot.line.me/en/manage/api">
              <MaskedInput
                value={watch('lineNotifyToken')}
                onChange={e => setValue('lineNotifyToken', e.target.value, { shouldDirty: true })}
                placeholder="ใส่ token ที่ได้จาก LINE"
              />
            </FieldRow>
          )}
        </SettingSection>

        <SettingSection title="อีเมล (SMTP)">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enableEmail')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">เปิดการแจ้งเตือนทางอีเมล</span>
          </label>
          {enableEmail && (
            <div className="space-y-3 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="SMTP Host">
                  <input {...register('smtpHost')} placeholder="smtp.gmail.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </FieldRow>
                <FieldRow label="Port">
                  <input {...register('smtpPort', { valueAsNumber: true })} type="number"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </FieldRow>
                <FieldRow label="Username">
                  <input {...register('smtpUser')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </FieldRow>
                <FieldRow label="Password">
                  <MaskedInput
                    value={watch('smtpPass')}
                    onChange={e => setValue('smtpPass', e.target.value, { shouldDirty: true })}
                  />
                </FieldRow>
              </div>
              <FieldRow label="From Email">
                <input {...register('fromEmail')} type="email"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </FieldRow>
            </div>
          )}
        </SettingSection>

        <SettingSection title="เหตุการณ์ที่ต้องการแจ้งเตือน">
          {[
            { name: 'notifyLowStock' as const,       label: 'สินค้าสต็อกต่ำ' },
            { name: 'notifyNewOrder' as const,        label: 'มีออเดอร์ใหม่' },
            { name: 'notifyShipmentUpdate' as const,  label: 'อัปเดตสถานะจัดส่ง' },
            { name: 'notifyDailyReport' as const,     label: 'สรุปยอดประจำวัน' },
          ].map(({ name, label }) => (
            <label key={name} className="flex items-center gap-3 cursor-pointer py-1">
              <input type="checkbox" {...register(name)} className="accent-orange-500 w-4 h-4" />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
          <FieldRow label="เวลาส่งสรุปประจำวัน">
            <input {...register('dailyReportTime')} type="time"
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
