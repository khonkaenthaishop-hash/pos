'use client';
import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

const MAX_BYTES = 2 * 1024 * 1024;
const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

async function compressToBase64(file: File, maxPx = 800): Promise<{ base64: string; name: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('compress failed')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({
          base64: (reader.result as string).split(',')[1],
          name: file.name,
        });
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.82);
    };
    img.onerror = reject;
    img.src = objUrl;
  });
}

interface Props { value: string; onChange: (url: string) => void; }

export default function ImageUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) { setError('รองรับเฉพาะไฟล์รูปภาพ'); return; }
    if (file.size > MAX_BYTES) { setError('ไฟล์ใหญ่เกิน 2MB'); return; }
    if (!APPS_SCRIPT_URL) { setError('ยังไม่ได้ตั้งค่า NEXT_PUBLIC_APPS_SCRIPT_URL'); return; }
    setIsUploading(true);
    try {
      const { base64, name } = await compressToBase64(file);
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'image/jpeg', data: base64 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.url) throw new Error(json.error || 'ไม่ได้รับ URL');
      onChange(json.url);
    } catch (e: unknown) {
      setError((e as Error).message || 'อัปโหลดล้มเหลว');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder="URL รูปภาพ หรืออัปโหลดจากเครื่อง"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-sm hover:bg-orange-100 disabled:opacity-50">
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {isUploading ? 'กำลังอัป...' : 'อัปโหลด'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {value && (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-0.5 text-gray-400 hover:text-red-500">
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
