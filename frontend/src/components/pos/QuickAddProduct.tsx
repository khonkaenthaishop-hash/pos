'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2, Check, ScanBarcode, RefreshCw } from 'lucide-react';
import { productsApi, categoriesApi } from '@/lib/api';
import toast from 'react-hot-toast';

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

type ScannedInfo = {
  nameTh: string;
  nameEn: string;
  barcode: string;
};

type Category = {
  id: string;
  nameTh: string;
  nameEn: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function scanProduct(file: File): Promise<ScannedInfo> {
  const data = await fileToBase64(file);
  const res = await fetch('/api/scan-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productImage: { data, mediaType: file.type },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Scan failed');
  }
  return res.json() as Promise<ScannedInfo>;
}

async function uploadImage(file: File, sku: string): Promise<string> {
  const base64 = await fileToBase64(file);
  const res = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType: file.type, publicId: sku }),
  });
  const json = await res.json() as { url?: string; error?: string };
  if (json.error) throw new Error(json.error);
  if (!json.url) throw new Error('No URL returned');
  return json.url;
}

function generateSku(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `SKU-${now}-${rand}`;
}

export default function QuickAddProduct({ onClose, onSaved }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isScanning, setIsScanning]     = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [scanned, setScanned]           = useState(false);
  const [formVisible, setFormVisible]   = useState(false);
  const showForm = scanned || formVisible;

  const [nameTh, setNameTh]             = useState('');
  const [nameEn, setNameEn]             = useState('');
  const [barcode, setBarcode]           = useState('');
  const [price, setPrice]               = useState('');
  const [sku, setSku]                   = useState('');
  const [unit, setUnit]                 = useState('');
  const [categoryId, setCategoryId]     = useState('');
  const [expiryDate, setExpiryDate]     = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [imageUrl, setImageUrl]         = useState('');

  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoriesApi.list().then(res => {
      setCategories((res.data as Category[]) || []);
    }).catch(() => {});
  }, []);

  function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setScanned(false);
    setFormVisible(true);
    setNameTh(''); setNameEn(''); setBarcode(''); setPrice('');
    setSku(generateSku()); setUnit(''); setCategoryId(''); setExpiryDate(''); setLocationCode(''); setImageUrl('');
    e.target.value = '';
  }

  async function handleScan() {
    if (!imageFile) return;
    setIsScanning(true);
    try {
      const newSku = sku || generateSku();
      const [info, url] = await Promise.all([
        scanProduct(imageFile),
        uploadImage(imageFile, newSku).catch(() => ''),
      ]);
      setNameTh(info.nameTh || nameTh);
      setNameEn(info.nameEn || nameEn);
      setBarcode(info.barcode || barcode);
      setSku(newSku);
      setImageUrl(url);
      setScanned(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  }

  async function handleSave() {
    if (!nameTh && !nameEn) { toast.error('Product name required'); return; }
    if (!price || Number(price) <= 0) { toast.error('Price required'); return; }
    setIsSaving(true);
    try {
      await productsApi.create({
        nameTh:       nameTh || nameEn,
        nameEn:       nameEn || undefined,
        barcode:      barcode || undefined,
        retailPrice:  Number(price),
        sku:          sku || undefined,
        unit:         unit || undefined,
        categoryId:   categoryId || undefined,
        expiryDate:   expiryDate || undefined,
        locationCode: locationCode || undefined,
        imageUrl:     imageUrl || undefined,
        isApproved:   false,
      });
      toast.success('Product saved');
      onSaved();
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 font-bold text-gray-800">
            <ScanBarcode size={18} className="text-orange-500" />
            Quick Add Product
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">

          {/* Camera capture */}
          <div
            onClick={() => cameraInputRef.current?.click()}
            className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-400 cursor-pointer flex flex-col items-center justify-center overflow-hidden bg-gray-50 relative"
          >
            {imagePreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="product" className="w-full h-full object-contain" />
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                  <RefreshCw size={11} /> Retake
                </div>
              </>
            ) : (
              <>
                <Camera size={36} className="text-gray-300 mb-2" />
                <span className="text-sm font-medium text-gray-400">Tap to open camera</span>
                <span className="text-xs text-gray-300 mt-1">Point at product label or barcode</span>
              </>
            )}
          </div>

          {/* Hidden camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
          />

          {/* Scan button */}
          {imagePreview && !scanned && showForm && (
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {isScanning
                ? <><Loader2 size={15} className="animate-spin" /> Reading with AI...</>
                : <><ScanBarcode size={15} /> Read with AI (OCR)</>
              }
            </button>
          )}

          {/* Form after photo taken */}
          {showForm && (
            <div className="space-y-3">
              {scanned && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                  <Check size={13} /> AI filled — review and edit if needed
                </div>
              )}

              {/* Thai name */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Thai name</label>
                <input value={nameTh} onChange={e => setNameTh(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>

              {/* English name */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">English name</label>
                <input value={nameEn} onChange={e => setNameEn(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>

              {/* Barcode */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Barcode</label>
                <input value={barcode} onChange={e => setBarcode(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono" />
              </div>

              {/* SKU */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SKU</label>
                <div className="flex gap-2">
                  <input value={sku} onChange={e => setSku(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono" />
                  <button
                    type="button"
                    onClick={() => setSku(generateSku())}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs text-gray-600 whitespace-nowrap">
                    Gen
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                  <option value="">— Select category —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.nameTh || c.nameEn}</option>
                  ))}
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Unit (หน่วยนับ)</label>
                <input value={unit} onChange={e => setUnit(e.target.value)}
                  placeholder="e.g. ชิ้น, กก., ขวด"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>

              {/* Price */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Retail price (THB) *</label>
                <input
                  type="number" min="0" step="0.5"
                  value={price} onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expiry date (วันหมดอายุ)</label>
                <input
                  type="date"
                  value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>

              {/* Location */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Location (ตำแหน่งจัดเก็บ)</label>
                <input value={locationCode} onChange={e => setLocationCode(e.target.value)}
                  placeholder="e.g. A1, B2-3"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono" />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setScanned(false); setFormVisible(false); cameraInputRef.current?.click(); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                  <RefreshCw size={13} /> Retake
                </button>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
