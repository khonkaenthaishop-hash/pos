'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';
import { carriersApi } from '@/lib/api';

interface ShippingSettings {
  defaultCarrierId: string;
  cutoffTime: string;
  packagingFee: number;
  freeShippingThreshold: number;
  defaultWeightUnit: string;
}

const DEFAULTS: ShippingSettings = {
  defaultCarrierId: '',
  cutoffTime: '14:00',
  packagingFee: 0,
  freeShippingThreshold: 0,
  defaultWeightUnit: 'kg',
};

const CARRIER_LABELS: Record<string, string> = {
  seven_eleven: '7-Eleven',
  family_mart:  'Family Mart',
  ok_mart:      'OK Mart',
  hilife:       'Hi-Life',
  black_cat:    'Black Cat (แมวดำ)',
  post:         'ไปรษณีย์ไทย',
};

export default function ShippingSettingsPage() {
  const { data, isLoading, save } = useSettings<ShippingSettings>('shipping');
  const [carriers, setCarriers] = useState<{ key: string; name: string }[]>([]);
  const { register, handleSubmit, reset, formState: { isDirty, isSubmitting } } = useForm<ShippingSettings>({
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    carriersApi.list().then(r => {
      const keys = [...new Set<string>((r.data as any[]).map((c: any) => c.carrier ?? c.key ?? c.id))];
      setCarriers(keys.map(k => ({ key: k, name: CARRIER_LABELS[k] ?? k })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (data) reset({ ...DEFAULTS, ...data });
  }, [data, reset]);

  const onSubmit = async (values: ShippingSettings) => {
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="การขนส่ง" description="ผู้ให้บริการและค่าธรรมเนียมการจัดส่ง">
        <SettingSection title="ผู้ให้บริการ">
          <FieldRow label="ผู้ให้บริการค่าเริ่มต้น">
            <select {...register('defaultCarrierId')} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">-- ไม่ระบุ --</option>
              {carriers.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="เวลาตัดรอบ" hint="ออเดอร์ที่เข้ามาหลังเวลานี้จะนับเป็นวันถัดไป">
            <input {...register('cutoffTime')} type="time"
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
        </SettingSection>

        <SettingSection title="ค่าธรรมเนียม">
          <FieldRow label="ค่าแพ็คกิ้ง (บาท)">
            <input {...register('packagingFee', { valueAsNumber: true, min: 0 })} type="number" min={0}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
          <FieldRow label="ฟรีค่าส่งเมื่อยอดถึง (บาท)" hint="0 = ไม่มีฟรีค่าส่ง">
            <input {...register('freeShippingThreshold', { valueAsNumber: true, min: 0 })} type="number" min={0}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
          <FieldRow label="หน่วยน้ำหนัก">
            <select {...register('defaultWeightUnit')} className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="kg">กิโลกรัม (kg)</option>
              <option value="g">กรัม (g)</option>
            </select>
          </FieldRow>
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
