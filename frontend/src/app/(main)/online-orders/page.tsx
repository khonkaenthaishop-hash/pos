'use client';
import { useState, useEffect } from 'react';
import { ordersApi, customersApi } from '@/lib/api';
import { CARRIERS, type CarrierKey, type TemperatureType } from '@/constants/carriers';
import { useCarriers } from '@/hooks/useCarriers';
import toast from 'react-hot-toast';
import { Plus, Package, List, Loader2, Copy } from 'lucide-react';

type View = 'list' | 'new';

const STATUS_LABEL: Record<string, { label: string; style: string }> = {
  pending:   { label: 'รอดำเนินการ', style: 'bg-amber-50 text-amber-600' },
  packing:   { label: 'กำลังแพ็ค',  style: 'bg-blue-50 text-blue-600' },
  shipped:   { label: 'จัดส่งแล้ว', style: 'bg-indigo-50 text-indigo-600' },
  delivered: { label: 'ถึงแล้ว',    style: 'bg-emerald-50 text-emerald-600' },
  cancelled: { label: 'ยกเลิก',     style: 'bg-gray-100 text-gray-400' },
};

export default function OnlineOrdersPage() {
  const { carriers: carrierList } = useCarriers();
  const [view, setView]     = useState<View>('list');
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  type CartItem = { productId: string; productNameTh: string; unitPrice: number; quantity: number };

  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerLine: '',
    orderNickname: '',
    recipientName: '', recipientPhone: '',
    addressLine: '', city: '', district: '', postal: '',
    storeCode: '', storeName: '',
    carrier: 'seven_eleven' as CarrierKey,
    temperature: 'normal' as TemperatureType,
    packageSize: 'small' as 'small' | 'medium' | 'large',
    shippingFee: '0',
    paymentMethod: 'transfer',
    notes: '',
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemInput, setItemInput] = useState({ productNameTh: '', unitPrice: '', quantity: '1' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const res = await ordersApi.list({ type: 'online' });
      const list = (res.data || []) as Record<string, unknown>[];
      setOrders(list);
      setStatusDraft(d => {
        const next = { ...d };
        for (const o of list) {
          const id = o.id as string;
          if (!next[id]) next[id] = String(o.status || 'pending');
        }
        return next;
      });
    } finally { setIsLoading(false); }
  };

  useEffect(() => { loadOrders(); }, []);

  const addItem = () => {
    const name = itemInput.productNameTh.trim();
    const price = Number(itemInput.unitPrice);
    const qty = Number(itemInput.quantity);
    if (!name || price <= 0 || qty <= 0) { toast.error('กรอกชื่อ ราคา และจำนวนให้ถูกต้อง'); return; }
    setCart(c => [...c, { productId: '', productNameTh: name, unitPrice: price, quantity: qty }]);
    setItemInput({ productNameTh: '', unitPrice: '', quantity: '1' });
  };

  const handleCreateOrder = async () => {
    if (!form.customerName || !form.recipientName || !form.addressLine) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    if (cart.length === 0) { toast.error('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'); return; }
    setIsSubmitting(true);
    try {
      // Upsert customer
      let customerId: string | null = null;
      try {
        const custRes = await customersApi.create({
          name: form.customerName,
          phone: form.customerPhone,
          lineId: form.customerLine,
        });
        customerId = custRes.data?.id || null;
      } catch { /* customer might already exist */ }

      const recipientAddress = [
        form.addressLine,
        form.district,
        form.city,
        form.postal,
      ].filter(Boolean).join(' ');

      await ordersApi.createOnline({
        items: cart.map(i => ({
          productId: i.productId || undefined,
          productNameTh: i.productNameTh,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
        shippingFee: Number(form.shippingFee) || 0,
        customerName: form.customerName,
        customerId,
        orderNickname: form.orderNickname || undefined,
        recipientName: form.recipientName,
        recipientPhone: form.recipientPhone,
        carrier: form.carrier,
        paymentMethod: form.paymentMethod,
        temperature: form.temperature,
        packageSize: form.packageSize,
        storeCode: form.storeCode || undefined,
        storeName: form.storeName || undefined,
        recipientAddress,
        note: form.notes,
      });
      toast.success('สร้างออเดอร์สำเร็จ');
      setCart([]);
      setView('list');
      loadOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setIsSubmitting(false); }
  };

  const carrierConfig = CARRIERS[form.carrier];

  const updateStatus = async (id: string) => {
    setBusyId(id);
    try {
      await ordersApi.updateStatus(id, statusDraft[id] || 'pending');
      toast.success('อัปเดตสถานะแล้ว');
      await loadOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'อัปเดตไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const cancelOrder = async (id: string) => {
    const reason = prompt('เหตุผลที่ยกเลิกบิล');
    if (!reason) return;
    setBusyId(id);
    try {
      await ordersApi.cancel(id, reason);
      toast.success('ยกเลิกแล้ว');
      await loadOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold text-gray-900">ออเดอร์ออนไลน์</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'list' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <List size={15} /> รายการ
          </button>
          <button onClick={() => setView('new')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'new' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Plus size={15} /> สร้างใหม่
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {view === 'list' ? (
          /* Order List */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-gray-300">
                <Package size={32} strokeWidth={1} />
                <span className="text-sm">ยังไม่มีออเดอร์</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">หมายเลข</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ผู้รับ</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ขนส่ง</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-56">สถานะ</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ยอด</th>
                    <th className="px-4 py-3 w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const statusMeta = STATUS_LABEL[(o.status as string)] || { label: o.status as string, style: 'bg-gray-100 text-gray-400' };
                    const id = o.id as string;
                    const busy = busyId === id;
                    return (
                      <tr key={o.id as string} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-mono text-xs text-gray-600">{o.orderNo as string}</div>
                          <button onClick={() => { navigator.clipboard.writeText(o.orderNo as string); toast.success('คัดลอกแล้ว'); }}
                            className="text-gray-300 hover:text-gray-500 mt-0.5">
                            <Copy size={11} />
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-gray-800">{(o.recipientName as string) || '—'}</div>
                          <div className="text-xs text-gray-400">{(o.recipientPhone as string) || '—'}</div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">{o.carrier as string}</td>
                        <td className="text-center px-4 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <select
                              value={statusDraft[id] || (o.status as string) || 'pending'}
                              onChange={e => setStatusDraft(s => ({ ...s, [id]: e.target.value }))}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-orange-400 bg-white text-gray-700"
                            >
                              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => updateStatus(id)}
                              disabled={busy}
                              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-lg text-xs font-semibold transition"
                            >
                              {busy ? <Loader2 size={12} className="animate-spin inline-block" /> : 'บันทึก'}
                            </button>
                          </div>
                          <div className="mt-1">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusMeta.style}`}>{statusMeta.label}</span>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3.5 font-semibold text-gray-800">
                          {Number(o.totalAmount || 0).toLocaleString()} ฿
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => cancelOrder(id)}
                            disabled={busy}
                            className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 rounded-lg text-xs font-semibold transition"
                          >
                            ยกเลิก
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* New Order Form */
          <div className="max-w-2xl space-y-4">
            {/* Customer Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">ข้อมูลลูกค้า</h3>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.customerName} onChange={e => setForm(f=>({...f, customerName: e.target.value}))}
                  placeholder="ชื่อลูกค้า *" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input value={form.customerPhone} onChange={e => setForm(f=>({...f, customerPhone: e.target.value}))}
                  placeholder="เบอร์โทร" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input value={form.customerLine} onChange={e => setForm(f=>({...f, customerLine: e.target.value}))}
                  placeholder="LINE ID" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input value={form.orderNickname} onChange={e => setForm(f=>({...f, orderNickname: e.target.value}))}
                  placeholder="ชื่อเล่นออเดอร์ (เช่น ครูแอน)" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
            </div>

            {/* Recipient + Address */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">ที่อยู่จัดส่ง</h3>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.recipientName} onChange={e => setForm(f=>({...f, recipientName: e.target.value}))}
                  placeholder="ชื่อผู้รับ *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input value={form.recipientPhone} onChange={e => setForm(f=>({...f, recipientPhone: e.target.value}))}
                  placeholder="เบอร์โทรผู้รับ" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input value={form.addressLine} onChange={e => setForm(f=>({...f, addressLine: e.target.value}))}
                  placeholder="ที่อยู่ *" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input value={form.district} onChange={e => setForm(f=>({...f, district: e.target.value}))}
                  placeholder="ตำบล/อำเภอ" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input value={form.city} onChange={e => setForm(f=>({...f, city: e.target.value}))}
                  placeholder="เมือง/จังหวัด" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">รายการสินค้า *</h3>
              <div className="flex gap-2 mb-3">
                <input value={itemInput.productNameTh} onChange={e => setItemInput(f=>({...f, productNameTh: e.target.value}))}
                  placeholder="ชื่อสินค้า *"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input type="number" value={itemInput.unitPrice} onChange={e => setItemInput(f=>({...f, unitPrice: e.target.value}))}
                  placeholder="ราคา/ชิ้น"
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <input type="number" min={1} value={itemInput.quantity} onChange={e => setItemInput(f=>({...f, quantity: e.target.value}))}
                  placeholder="จำนวน"
                  className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <button onClick={addItem}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition">
                  <Plus size={15} />
                </button>
              </div>
              {cart.length > 0 && (
                <div className="space-y-1.5">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-700 flex-1 truncate">{item.productNameTh}</span>
                      <span className="text-gray-500 text-xs mx-3">{item.quantity} × {item.unitPrice.toLocaleString()} ฿</span>
                      <span className="font-semibold text-gray-800 w-20 text-right">{(item.quantity * item.unitPrice).toLocaleString()} ฿</span>
                      <button onClick={() => setCart(c => c.filter((_, i) => i !== idx))}
                        className="ml-2 text-gray-300 hover:text-red-400 transition">✕</button>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1 text-sm font-semibold text-gray-800 border-t border-gray-100 mt-1">
                    รวม {cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toLocaleString()} ฿
                  </div>
                </div>
              )}
            </div>

            {/* Carrier */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">ขนส่ง</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {carrierList.map(c => (
                  <button key={c.key} onClick={() => setForm(f=>({...f, carrier: c.key}))}
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition text-left ${
                      form.carrier === c.key ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-700 hover:border-orange-300'
                    }`}>
                    {c.emoji} {c.name.th}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                {(['normal','cold','frozen'] as TemperatureType[]).map(t => (
                  <button key={t} onClick={() => setForm(f=>({...f, temperature: t}))}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition ${
                      form.temperature === t ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}>
                    {t === 'normal' ? 'ธรรมดา' : t === 'cold' ? 'เย็น' : 'แช่แข็ง'}
                  </button>
                ))}
              </div>
              {!carrierConfig.has_cold && form.temperature !== 'normal' && (
                <p className="text-xs text-red-500 mt-2">{carrierConfig.name.th} ไม่รองรับบริการเย็น</p>
              )}
              {/* Package size */}
              <div className="flex gap-2 mt-3">
                {(['small','medium','large'] as const).map(s => (
                  <button key={s} onClick={() => setForm(f=>({...f, packageSize: s}))}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition ${form.packageSize === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                    {s === 'small' ? 'เล็ก' : s === 'medium' ? 'กลาง' : 'ใหญ่'}
                  </button>
                ))}
              </div>
              {/* Shipping fee + store pickup */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">ค่าส่ง (฿)</label>
                  <input type="number" value={form.shippingFee} onChange={e => setForm(f=>({...f, shippingFee: e.target.value}))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">รหัสสาขา (storeCode)</label>
                  <input value={form.storeCode} onChange={e => setForm(f=>({...f, storeCode: e.target.value}))}
                    placeholder="เช่น 00123"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">ชื่อสาขา (storeName)</label>
                  <input value={form.storeName} onChange={e => setForm(f=>({...f, storeName: e.target.value}))}
                    placeholder="เช่น 7-Eleven สาขาแจ้งวัฒนะ"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">การชำระเงิน</h3>
              <div className="flex gap-2">
                {(['transfer', 'cod', 'qr'] as const).map(m => (
                  <button key={m} onClick={() => setForm(f=>({...f, paymentMethod: m }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                      form.paymentMethod === m ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}>
                    {m === 'transfer' ? 'โอนเงิน' : m === 'cod' ? 'เก็บปลายทาง' : 'QR'}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <textarea value={form.notes} onChange={e => setForm(f=>({...f, notes: e.target.value}))}
                placeholder="หมายเหตุ (ถ้ามี)"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={handleCreateOrder} disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                สร้างออเดอร์
              </button>
              <button onClick={() => setView('list')}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl text-sm transition">
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
