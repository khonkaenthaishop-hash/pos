'use client';
import { useRef, useState } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

async function uploadSlip(file: File): Promise<string> {
  if (!APPS_SCRIPT_URL) {
    // Fallback: use object URL (local only, for demo)
    return URL.createObjectURL(file);
  }
  const reader = new FileReader();
  const base64 = await new Promise<string>((res, rej) => {
    reader.onload = () => res((reader.result as string).split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `slip_${Date.now()}.jpg`, mimeType: file.type, data: base64 }),
  });
  const json = await response.json();
  if (!json.url) throw new Error(json.error || 'อัปโหลดสลิปไม่สำเร็จ');
  return json.url;
}

interface Props {
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
}

export default function SlipUpload({ value, onChange, required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) { setError('รองรับเฉพาะรูปภาพ'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('ไฟล์ใหญ่เกิน 5MB'); return; }
    setIsUploading(true);
    try {
      const url = await uploadSlip(file);
      onChange(url);
    } catch (e: unknown) {
      setError((e as Error).message || 'อัปโหลดล้มเหลว');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className={`border-2 border-dashed rounded-xl p-3 text-center transition ${required && !value ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
        {value ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="slip" className="max-h-32 mx-auto rounded-lg object-contain" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-0.5 text-red-500"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <ImageIcon size={24} className="mx-auto text-gray-300" />
            <p className="text-xs text-gray-500">
              {required ? <span className="text-red-500 font-semibold">* ต้องแนบสลิป</span> : 'แนบสลิปการโอน'}
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {isUploading ? 'กำลังอัปโหลด...' : (value ? 'เปลี่ยนสลิป' : 'อัปโหลดสลิป')}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
