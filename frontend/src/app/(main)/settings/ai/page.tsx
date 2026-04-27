'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { MaskedInput } from '@/components/settings/MaskedInput';
import { useSettings } from '@/hooks/useSettings';

const UNCHANGED = '__UNCHANGED__';

interface AiSettings {
  enableAi: boolean;
  aiProvider: string;
  apiKey: string;
  apiBaseUrl: string;
  modelName: string;
  enableProductDescriptionGen: boolean;
  enableSalesInsights: boolean;
  enableDemandForecast: boolean;
}

const DEFAULTS: AiSettings = {
  enableAi: false,
  aiProvider: 'openai',
  apiKey: '',
  apiBaseUrl: '',
  modelName: 'gpt-4o-mini',
  enableProductDescriptionGen: false,
  enableSalesInsights: false,
  enableDemandForecast: false,
};

export default function AiSettingsPage() {
  const { data, isLoading, save } = useSettings<AiSettings>('ai');
  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty, isSubmitting } } = useForm<AiSettings>({
    defaultValues: DEFAULTS,
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const enableAi = watch('enableAi');
  const provider = watch('aiProvider');

  useEffect(() => {
    if (data) reset({ ...DEFAULTS, ...data });
  }, [data, reset]);

  const onSubmit = async (values: AiSettings) => {
    const payload = { ...values };
    if (payload.apiKey === '****') payload.apiKey = UNCHANGED;
    const ok = await save(payload as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="AI & โมเดล" description="การตั้งค่า AI สำหรับช่วยเพิ่มประสิทธิภาพการทำงาน">
        <SettingSection title="การเปิดใช้งาน">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('enableAi')} className="accent-orange-500 w-4 h-4" />
            <div>
              <span className="text-sm font-medium text-slate-700">เปิดใช้งาน AI</span>
              <p className="text-xs text-slate-400">ต้องการ API Key จากผู้ให้บริการ AI</p>
            </div>
          </label>
        </SettingSection>

        {enableAi && (
          <>
            <SettingSection title="ผู้ให้บริการ">
              <FieldRow label="Provider">
                <select {...register('aiProvider')} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="openai">OpenAI</option>
                  <option value="openai-compatible">OpenAI-Compatible (Ollama, LocalAI)</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
              </FieldRow>
              {provider === 'openai-compatible' && (
                <FieldRow label="Base URL" hint="เช่น http://localhost:11434/v1">
                  <input {...register('apiBaseUrl')} placeholder="http://..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </FieldRow>
              )}
              <FieldRow label="API Key">
                <MaskedInput
                  value={watch('apiKey')}
                  onChange={e => setValue('apiKey', e.target.value, { shouldDirty: true })}
                  placeholder="sk-..."
                />
              </FieldRow>
              <FieldRow label="Model">
                <input {...register('modelName')} placeholder="gpt-4o-mini"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </FieldRow>
            </SettingSection>

            <SettingSection title="ฟีเจอร์ AI">
              {[
                { name: 'enableProductDescriptionGen' as const, label: 'สร้างคำอธิบายสินค้าอัตโนมัติ' },
                { name: 'enableSalesInsights' as const,          label: 'วิเคราะห์ยอดขายและแนวโน้ม' },
                { name: 'enableDemandForecast' as const,         label: 'คาดการณ์ความต้องการสินค้า' },
              ].map(({ name, label }) => (
                <label key={name} className="flex items-center gap-3 cursor-pointer py-1">
                  <input type="checkbox" {...register(name)} className="accent-orange-500 w-4 h-4" />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </SettingSection>
          </>
        )}
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
