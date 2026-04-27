'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';

interface AnalyticsSettings {
  defaultDateRange: string;
  defaultMetrics: string[];
  reportTimezone: string;
  fiscalYearStart: number;
  enableExportButton: boolean;
}

const DEFAULTS: AnalyticsSettings = {
  defaultDateRange: '30d',
  defaultMetrics: ['revenue', 'orders', 'avgOrder', 'topProducts'],
  reportTimezone: 'Asia/Bangkok',
  fiscalYearStart: 1,
  enableExportButton: true,
};

const METRICS = [
  { key: 'revenue',     label: 'ยอดขายรวม' },
  { key: 'orders',      label: 'จำนวนออเดอร์' },
  { key: 'avgOrder',    label: 'มูลค่าเฉลี่ยต่อออเดอร์' },
  { key: 'topProducts', label: 'สินค้าขายดี' },
  { key: 'stockValue',  label: 'มูลค่าสินค้าคงคลัง' },
  { key: 'grossProfit', label: 'กำไรขั้นต้น' },
];

export default function AnalyticsSettingsPage() {
  const { data, isLoading, save } = useSettings<AnalyticsSettings>('analytics');
  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty, isSubmitting } } = useForm<AnalyticsSettings>({
    defaultValues: DEFAULTS,
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedMetrics = watch('defaultMetrics') ?? [];

  useEffect(() => {
    if (data) reset({ ...DEFAULTS, ...data });
  }, [data, reset]);

  const toggleMetric = (key: string) => {
    const current = selectedMetrics;
    if (current.includes(key)) {
      setValue('defaultMetrics', current.filter(m => m !== key), { shouldDirty: true });
    } else {
      setValue('defaultMetrics', [...current, key], { shouldDirty: true });
    }
  };

  const onSubmit = async (values: AnalyticsSettings) => {
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="Analytics" description="การตั้งค่าหน้ารายงานและการแสดงผล">
        <SettingSection title="การแสดงผลเริ่มต้น">
          <FieldRow label="ช่วงเวลาเริ่มต้น">
            <select {...register('defaultDateRange')} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="today">วันนี้</option>
              <option value="7d">7 วันที่ผ่านมา</option>
              <option value="30d">30 วันที่ผ่านมา</option>
              <option value="90d">90 วันที่ผ่านมา</option>
            </select>
          </FieldRow>
          <FieldRow label="เขตเวลาสำหรับรายงาน">
            <select {...register('reportTimezone')} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
              <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
              <option value="UTC">UTC</option>
            </select>
          </FieldRow>
          <FieldRow label="เริ่มต้นปีงบประมาณ (เดือน)">
            <select {...register('fiscalYearStart', { valueAsNumber: true })} className="w-48 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              {['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'].map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </FieldRow>
        </SettingSection>

        <SettingSection title="ตัวชี้วัดที่แสดง">
          <div className="grid grid-cols-2 gap-2">
            {METRICS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-slate-50">
                <input type="checkbox"
                  checked={selectedMetrics.includes(key)}
                  onChange={() => toggleMetric(key)}
                  className="accent-orange-500 w-4 h-4" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </SettingSection>

        <SettingSection title="การส่งออก">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enableExportButton')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">แสดงปุ่ม Export ในหน้ารายงาน</span>
          </label>
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
