'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Download, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';
import { settingsApi } from '@/lib/api';

interface SystemSettings {
  maintenanceMode: boolean;
}

export default function SystemSettingsPage() {
  const { data, isLoading, save } = useSettings<SystemSettings>('system');
  const { register, handleSubmit, reset, formState: { isDirty, isSubmitting } } = useForm<SystemSettings>({
    defaultValues: { maintenanceMode: false },
  });
  const [sysInfo, setSysInfo] = useState<{ appVersion?: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (data) {
      setSysInfo(data as any);
      reset({ maintenanceMode: !!(data as any).maintenanceMode });
    }
  }, [data, reset]);

  const onSubmit = async (values: SystemSettings) => {
    if (values.maintenanceMode && !confirm('เปิดโหมดบำรุงรักษา? ผู้ใช้อื่นจะไม่สามารถเข้าใช้งานได้')) return;
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  const handleClearCache = async () => {
    if (!confirm('ล้างแคชทั้งหมด?')) return;
    setClearing(true);
    try {
      await settingsApi.clearCache();
      toast.success('ล้างแคชเรียบร้อยแล้ว');
    } catch {
      toast.error('ล้างแคชไม่สำเร็จ');
    } finally {
      setClearing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await settingsApi.exportData();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settings-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('ส่งออกข้อมูลไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="ระบบ" description="ข้อมูลระบบและการบำรุงรักษา">
        <SettingSection title="ข้อมูลระบบ">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-slate-600">เวอร์ชัน</span>
            <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
              {(sysInfo as any)?.appVersion ?? '1.0.0'}
            </span>
          </div>
        </SettingSection>

        <SettingSection title="โหมดบำรุงรักษา">
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" {...register('maintenanceMode')} className="accent-orange-500 w-4 h-4" />
            <div>
              <span className="text-sm font-medium text-slate-700">เปิดโหมดบำรุงรักษา</span>
              <p className="text-xs text-slate-400">ผู้ใช้ทั่วไปจะไม่สามารถเข้าใช้งานได้ชั่วคราว</p>
            </div>
          </label>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mt-1">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">เจ้าของร้านยังคงเข้าใช้งานได้ตามปกติในทุกกรณี</p>
          </div>
        </SettingSection>

        <SettingSection title="ข้อมูล">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Export การตั้งค่า</p>
              <p className="text-xs text-slate-400 mb-2">ดาวน์โหลดการตั้งค่าทั้งหมดเป็นไฟล์ JSON</p>
              <button type="button" onClick={handleExport} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition">
                <Download size={15} />
                {exporting ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด JSON'}
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">ล้างแคช</p>
              <p className="text-xs text-slate-400 mb-2">ล้างข้อมูลแคชในระบบ (ไม่มีผลต่อข้อมูลจริง)</p>
              <button type="button" onClick={handleClearCache} disabled={clearing}
                className="flex items-center gap-2 px-4 py-2.5 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition">
                <Trash2 size={15} />
                {clearing ? 'กำลังล้าง...' : 'ล้างแคช'}
              </button>
            </div>
          </div>
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ maintenanceMode: !!(data as any)?.maintenanceMode })} />
    </form>
  );
}
