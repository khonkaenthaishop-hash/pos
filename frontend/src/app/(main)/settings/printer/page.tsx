'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';

interface PrinterSettings {
  printerIp: string;
  printerPort: number;
  paperWidth: 55 | 72;
  encoding: string;
  /** ESC/POS codepage number for `ESC t n` */
  codePage: number;
  printMode: string;
  autoPrint: boolean;
  printCopies: number;
}

const DEFAULTS: PrinterSettings = {
  printerIp: '192.168.1.121',
  printerPort: 9100,
  paperWidth: 72,
  encoding: 'TIS620',
  // Use the printer self-test value for Thai/PC874 (ESC t n).
  codePage: 70,
  printMode: 'ESC-POS',
  autoPrint: false,
  printCopies: 1,
};

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export default function PrinterSettingsPage() {
  const { data, isLoading, save } = useSettings<PrinterSettings>('printer');
  const { register, handleSubmit, reset, formState: { isDirty, isSubmitting, errors } } = useForm<PrinterSettings>({
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (data) {
      const normalized = {
        ...DEFAULTS,
        ...data,
        paperWidth:
          data.paperWidth === 58 ? 55 : data.paperWidth === 80 ? 72 : data.paperWidth,
      };
      reset(normalized);
    }
  }, [data, reset]);

  const onSubmit = async (values: PrinterSettings) => {
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="เครื่องพิมพ์" description="การตั้งค่าเครื่องพิมพ์ ESC/POS ผ่าน TCP">
        <SettingSection title="การเชื่อมต่อ">
          <FieldRow label="IP เครื่องพิมพ์" hint="เช่น 192.168.1.100">
            <input
              {...register('printerIp', {
                required: 'กรุณากรอก IP',
                pattern: { value: IP_REGEX, message: 'รูปแบบ IP ไม่ถูกต้อง' },
              })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="192.168.1.100"
            />
            {errors.printerIp && <p className="text-xs text-red-500 mt-1">{errors.printerIp.message}</p>}
          </FieldRow>
          <FieldRow label="Port">
            <input
              {...register('printerPort', { valueAsNumber: true, min: 1, max: 65535 })}
              type="number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
        </SettingSection>

        <SettingSection title="การพิมพ์">
          <FieldRow label="ความกว้างกระดาษ">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value={55}
                  {...register('paperWidth', { valueAsNumber: true })}
                  className="accent-orange-500 w-4 h-4"
                />
                <span className="text-sm text-slate-700">55 mm</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value={72}
                  {...register('paperWidth', { valueAsNumber: true })}
                  className="accent-orange-500 w-4 h-4"
                />
                <span className="text-sm text-slate-700">72 mm</span>
              </label>
            </div>
          </FieldRow>
          <FieldRow label="Encoding">
            <select {...register('encoding')} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="TIS620">TIS620 (Windows-874)</option>
              <option value="UTF-8">UTF-8</option>
            </select>
          </FieldRow>
          <FieldRow label="Code page" hint="ค่า ESC t n (Thai/CP874 มักใช้ 26; ดูจาก self-test ของเครื่อง)">
            <input
              {...register('codePage', { valueAsNumber: true, min: 0, max: 255 })}
              type="number"
              min={0}
              max={255}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
          <FieldRow label="โหมดการพิมพ์">
            <select {...register('printMode')} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="ESC-POS">ESC/POS (TCP/IP)</option>
              <option value="RAWBT">Android (RawBT)</option>
              <option value="Star">Star</option>
            </select>
          </FieldRow>
          <FieldRow label="จำนวนสำเนา">
            <input
              {...register('printCopies', { valueAsNumber: true, min: 1, max: 5 })}
              type="number"
              min={1}
              max={5}
              className="w-32 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('autoPrint')} className="accent-orange-500 w-4 h-4" />
            <span className="text-sm text-slate-700">พิมพ์อัตโนมัติเมื่อชำระเงิน</span>
          </label>
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
