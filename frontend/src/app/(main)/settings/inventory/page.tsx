'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';

interface InventorySettings {
  lowStockThreshold: number;
  enableAutoReorder: boolean;
  expiryTracking: boolean;
  expiryWarningDays: number;
  requireBatchNumber: boolean;
}

const DEFAULTS: InventorySettings = {
  lowStockThreshold: 5,
  enableAutoReorder: false,
  expiryTracking: false,
  expiryWarningDays: 30,
  requireBatchNumber: false,
};

export default function InventorySettingsPage() {
  const { data, isLoading, save } = useSettings<InventorySettings>('inventory');
  const { register, handleSubmit, reset, formState: { isDirty, isSubmitting } } = useForm<InventorySettings>({
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (data) reset({ ...DEFAULTS, ...data });
  }, [data, reset]);

  const onSubmit = async (values: InventorySettings) => {
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="สินค้าคงคลัง" description="เกณฑ์สต็อกต่ำและการติดตามสินค้า">
        <SettingSection title="สต็อก">
          <FieldRow label="จำนวนขั้นต่ำก่อนแจ้งเตือน (Low Stock)" hint="แจ้งเตือนเมื่อสต็อกน้อยกว่าหรือเท่ากับค่านี้">
            <input
              {...register('lowStockThreshold', { valueAsNumber: true, min: 0 })}
              type="number"
              min={0}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enableAutoReorder')} className="accent-orange-500 w-4 h-4" />
            <div>
              <span className="text-sm text-slate-700">สั่งซื้ออัตโนมัติเมื่อสต็อกต่ำ</span>
              <p className="text-xs text-slate-400">ต้องตั้งค่า Supplier และจำนวน reorder ในสินค้าแต่ละชิ้น</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('requireBatchNumber')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">บังคับระบุ Batch Number เมื่อรับสินค้า</span>
          </label>
        </SettingSection>

        <SettingSection title="วันหมดอายุ">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('expiryTracking')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">เปิดการติดตามวันหมดอายุ</span>
          </label>
          <FieldRow label="แจ้งเตือนล่วงหน้า (วัน)">
            <input
              {...register('expiryWarningDays', { valueAsNumber: true, min: 1 })}
              type="number"
              min={1}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
