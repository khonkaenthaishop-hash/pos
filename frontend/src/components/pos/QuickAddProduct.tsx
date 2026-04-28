'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2, Check, ScanBarcode, RefreshCw, Scan } from 'lucide-react';
import { productsApi, categoriesApi, locationsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import BarcodeScanner from './BarcodeScanner';

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

type LocationRow = {
  id: number;
  fullCode: string;
  isActive?: boolean;
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

/** สร้าง EAN-13 ที่ valid — 12 หลักสุ่ม + check digit คำนวณถูกต้อง */
function generateEAN13(): string {
  // สุ่ม 12 หลัก (prefix 200-299 = in-house range ไม่ซ้ำกับ GS1 จริง)
  const prefix = String(Math.floor(Math.random() * 100) + 200); // 200–299
  const body = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  const digits = (prefix + body).split('').map(Number);
  // EAN-13 check digit: odd pos × 1, even pos × 3
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return digits.join('') + check;
}

export default function QuickAddProduct({ onClose, onSaved }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

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
  const [unit, setUnit]                 = useState('ชิ้น');
  const [categoryId, setCategoryId]     = useState('');
  const [expiryDate, setExpiryDate]     = useState('');
  const [locationCode, setLocationCode] = useState('FRONT');
  const [imageUrl, setImageUrl]         = useState('');

  const [minStock, setMinStock] = useState('10');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [promoQty, setPromoQty] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [wholesaleUnit, setWholesaleUnit] = useState('เซต');
  const [conversionFactor, setConversionFactor] = useState('1');

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [customUnit, setCustomUnit] = useState('');
  const [customLocation, setCustomLocation] = useState('');

  useEffect(() => {
    categoriesApi.list().then(res => {
      setCategories((res.data as Category[]) || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    locationsApi.list().then(res => {
      setLocations(((res.data as LocationRow[]) || []).filter(l => l && l.fullCode));
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
    setSku(generateSku());
    setUnit('ชิ้น');
    setCustomUnit('');
    setCategoryId('');
    setExpiryDate('');
    setLocationCode('FRONT');
    setCustomLocation('');
    setImageUrl('');
    setMinStock('10');
    setWholesalePrice('');
    setPromoQty('');
    setPromoPrice('');
    setWholesaleUnit('เซต');
    setConversionFactor('1');
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
      const finalSku = sku || generateSku();
      if (!sku) setSku(finalSku);

      // Ensure imageUrl is persisted even if user skips "Scan" step.
      let finalImageUrl = imageUrl;
      if (!finalImageUrl && imageFile) {
        finalImageUrl = await uploadImage(imageFile, finalSku).catch(() => '');
        if (finalImageUrl) setImageUrl(finalImageUrl);
      }

      const finalUnit = unit === '__custom__' ? (customUnit.trim() || 'ชิ้น') : (unit || 'ชิ้น');
      const finalLocation = locationCode === '__custom__'
        ? (customLocation.trim() || 'FRONT')
        : (locationCode || 'FRONT');

      await productsApi.create({
        nameTh:       nameTh || nameEn,
        nameEn:       nameEn || undefined,
        barcode:      barcode || undefined,
        retailPrice:  Number(price),
        sku:          finalSku || undefined,
        unit:         finalUnit || undefined,
        categoryId:   categoryId || undefined,
        expiryDate:   expiryDate || undefined,
        locationCode: finalLocation || undefined,
        minStock:     minStock ? Number(minStock) : 10,
        wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
        promoQty:       promoQty ? Number(promoQty) : undefined,
        promoPrice:     promoPrice ? Number(promoPrice) : undefined,
        wholesaleUnit:  wholesaleUnit?.trim() || undefined,
        conversionFactor: conversionFactor ? Number(conversionFactor) : undefined,
        imageUrl:     finalImageUrl || undefined,
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
                <div className="flex gap-2">
                  <input
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setBarcode(generateEAN13())}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs text-gray-600 whitespace-nowrap"
                  >
                    Gen EAN-13
                  </button>
                  <button
                    type="button"
                    title="เปิดกล้องสแกนบาร์โค้ด"
                    onClick={() => setShowCameraScanner(true)}
                    className="px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl text-orange-600"
                  >
                    <Scan size={15} />
                  </button>
                </div>
                {/* barcode scanner input — hidden text field รอรับค่าจากเครื่องสแกน */}
                {isScanningBarcode && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="ชี้เครื่องสแกนที่บาร์โค้ด..."
                      className="flex-1 border-2 border-orange-400 rounded-xl px-3 py-2 text-sm outline-none font-mono animate-pulse"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const val = (e.currentTarget.value).trim();
                          if (val) setBarcode(val);
                          setIsScanningBarcode(false);
                        }
                        if (e.key === 'Escape') setIsScanningBarcode(false);
                      }}
                      onBlur={e => {
                        const val = e.currentTarget.value.trim();
                        if (val) setBarcode(val);
                        setIsScanningBarcode(false);
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsScanningBarcode(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
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
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
                >
                  <option value="ชิ้น">ชิ้น</option>
                  <option value="แพ็ค">แพ็ค</option>
                  <option value="ขวด">ขวด</option>
                  <option value="กล่อง">กล่อง</option>
                  <option value="ถุง">ถุง</option>
                  <option value="กก.">กก.</option>
                  <option value="กรัม">กรัม</option>
                  <option value="ลิตร">ลิตร</option>
                  <option value="เซต">เซต</option>
                  <option value="__custom__">อื่นๆ…</option>
                </select>
                {unit === '__custom__' && (
                  <input
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="ระบุหน่วยนับ"
                    className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                )}
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

              {/* Min stock */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Min stock แจ้งเตือน</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                />
              </div>

              {/* Pack / Wholesale */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">ราคายกแพ็ค (Pack Price)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">หน่วยส่ง (wholesale unit)</label>
                  <input
                    value={wholesaleUnit}
                    onChange={(e) => setWholesaleUnit(e.target.value)}
                    placeholder="เช่น เซต"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">อัตราแปลงยกแพ็ค</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={conversionFactor}
                    onChange={(e) => setConversionFactor(e.target.value)}
                    placeholder="1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                  />
                </div>
              </div>

              {/* Promo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">โปรฯ ซื้อ (ชิ้น)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={promoQty}
                    onChange={(e) => setPromoQty(e.target.value)}
                    placeholder="เช่น 3"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">ราคาโปรฯ รวม ฿</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                  />
                </div>
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
                <select
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white font-mono"
                >
                  {/* Default */}
                  <option value="FRONT">front</option>
                  {/* Server locations */}
                  {locations
                    .filter((l) => l.fullCode && l.fullCode.toUpperCase() !== 'FRONT')
                    .map((l) => (
                      <option key={l.id} value={l.fullCode}>
                        {l.fullCode}
                      </option>
                    ))}
                  <option value="__custom__">อื่นๆ…</option>
                </select>
                {locationCode === '__custom__' && (
                  <input
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="ระบุ location (เช่น A1, B2-3)"
                    className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 font-mono"
                  />
                )}
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

      {/* Camera barcode scanner */}
      {showCameraScanner && (
        <BarcodeScanner
          onDetected={(code) => {
            setBarcode(code);
            setShowCameraScanner(false);
            toast.success(`สแกนได้: ${code}`);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}
    </div>
  );
}
