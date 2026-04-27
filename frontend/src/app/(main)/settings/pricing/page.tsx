'use client';
import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';

interface WholesaleTier { minQty: number; discountPct: number }
interface PricingSettings {
  defaultMarginPct: number;
  taxRate: number;
  taxIncluded: boolean;
  roundingPolicy: string;
  enableWholesale: boolean;
  wholesaleTiers: WholesaleTier[];
}

const DEFAULTS: PricingSettings = {
  defaultMarginPct: 30,
  taxRate: 0,
  taxIncluded: false,
  roundingPolicy: 'none',
  enableWholesale: false,
  wholesaleTiers: [],
};

export default function PricingSettingsPage() {
  const { data, isLoading, save } = useSettings<PricingSettings>('pricing');
  const { register, handleSubmit, reset, control, watch, formState: { isDirty, isSubmitting } } = useForm<PricingSettings>({
    defaultValues: DEFAULTS,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'wholesaleTiers' });
  // eslint-disable-next-line react-hooks/incompatible-library
  const enableWholesale = watch('enableWholesale');

  useEffect(() => {
    if (data) reset({ ...DEFAULTS, ...data });
  }, [data, reset]);

  const onSubmit = async (values: PricingSettings) => {
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="ราคาและภาษี" description="กำไรเริ่มต้น ภาษี และราคาส่ง">
        <SettingSection title="ราคา">
          <FieldRow label="อัตรากำไรเริ่มต้น (%)" hint="ใช้เมื่อเพิ่มสินค้าใหม่">
            <input {...register('defaultMarginPct', { valueAsNumber: true, min: 0, max: 100 })}
              type="number" min={0} max={100}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
          <FieldRow label="การปัดเศษราคา">
            <select {...register('roundingPolicy')} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="none">ไม่ปัด</option>
              <option value="round05">ปัดไป .0 หรือ .5</option>
              <option value="round1">ปัดเป็นจำนวนเต็ม</option>
            </select>
          </FieldRow>
        </SettingSection>

        <SettingSection title="ภาษี">
          <FieldRow label="อัตราภาษี (%)" hint="0 = ไม่มีภาษี">
            <input {...register('taxRate', { valueAsNumber: true, min: 0, max: 30 })}
              type="number" min={0} max={30} step={0.1}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </FieldRow>
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('taxIncluded')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">รวมภาษีในราคาขายแล้ว (Tax Included)</span>
          </label>
        </SettingSection>

        <SettingSection title="ราคาส่ง (Wholesale)">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enableWholesale')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">เปิดใช้งานราคาส่ง</span>
          </label>
          {enableWholesale && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-500 uppercase px-1">
                <span>ซื้อขั้นต่ำ (ชิ้น)</span>
                <span>ส่วนลด (%)</span>
                <span />
              </div>
              {fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-3 gap-2 items-center">
                  <input {...register(`wholesaleTiers.${i}.minQty`, { valueAsNumber: true, min: 1 })}
                    type="number" min={1}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <input {...register(`wholesaleTiers.${i}.discountPct`, { valueAsNumber: true, min: 0, max: 100 })}
                    type="number" min={0} max={100}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <button type="button" onClick={() => remove(i)} className="p-2 text-slate-400 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => append({ minQty: 10, discountPct: 5 })}
                className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 font-medium">
                <Plus size={14} /> เพิ่มระดับ
              </button>
            </div>
          )}
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
