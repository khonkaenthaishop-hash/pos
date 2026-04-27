'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection, FieldRow } from '@/components/settings/SettingSection';
import { SaveBar } from '@/components/settings/SaveBar';
import { useSettings } from '@/hooks/useSettings';

interface GeneralSettings {
  storeName: string;
  logoUrl: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  timezone: string;
  language: string;
  currency: string;
}

const DEFAULTS: GeneralSettings = {
  storeName: 'ร้านขอนแก่น 坤敬 THAISHOP',
  logoUrl: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  timezone: 'Asia/Bangkok',
  language: 'th',
  currency: 'THB',
};

export default function GeneralSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as Record<string, string>)?.role;

  useEffect(() => {
    if (session && role !== 'owner' && role !== 'manager') router.replace('/settings/general');
  }, [session, role, router]);

  const { data, isLoading, save } = useSettings<GeneralSettings>('general');
  const { register, handleSubmit, reset, formState: { isDirty, isSubmitting } } = useForm<GeneralSettings>({
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (data) reset({ ...DEFAULTS, ...data });
  }, [data, reset]);

  const onSubmit = async (values: GeneralSettings) => {
    const ok = await save(values as any);
    if (ok) reset(values);
  };

  if (isLoading) return <div className="text-sm text-slate-400 p-4">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell title="ข้อมูลร้านค้า" description="ชื่อร้าน โลโก้ และข้อมูลติดต่อ">
        <SettingSection title="ข้อมูลพื้นฐาน">
          <FieldRow label="ชื่อร้านค้า">
            <input
              {...register('storeName', { required: true, maxLength: 100 })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
          <FieldRow label="URL โลโก้" hint="ลิงก์รูปโลโก้ (แนะนำ PNG พื้นหลังใส)">
            <input
              {...register('logoUrl')}
              type="url"
              placeholder="https://..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
          <FieldRow label="เบอร์โทรศัพท์">
            <input
              {...register('phone')}
              type="tel"
              placeholder="09x-xxx-xxxx"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
        </SettingSection>

        <SettingSection title="ที่อยู่">
          <FieldRow label="ที่อยู่บรรทัด 1">
            <input
              {...register('addressLine1')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
          <FieldRow label="ที่อยู่บรรทัด 2">
            <input
              {...register('addressLine2')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </FieldRow>
        </SettingSection>

        <SettingSection title="การแสดงผล">
          <FieldRow label="เขตเวลา">
            <select
              {...register('timezone')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
              <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
              <option value="UTC">UTC</option>
            </select>
          </FieldRow>
          <FieldRow label="ภาษาเริ่มต้น">
            <select
              {...register('language')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="th">ภาษาไทย</option>
              <option value="zh_TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </FieldRow>
          <FieldRow label="สกุลเงิน">
            <select
              {...register('currency')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="THB">THB — บาทไทย</option>
              <option value="TWD">TWD — ดอลลาร์ไต้หวัน</option>
            </select>
          </FieldRow>
        </SettingSection>
      </SettingsPageShell>
      <SaveBar isDirty={isDirty} isSubmitting={isSubmitting} onReset={() => reset({ ...DEFAULTS, ...data })} />
    </form>
  );
}
