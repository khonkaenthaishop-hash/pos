'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { shipmentsApi, ordersApi } from '@/lib/api';
import { Copy, Loader2, Package, Plus, RefreshCw, Search, Truck, X } from 'lucide-react';
import { useCarriers } from '@/hooks/useCarriers';

type Shipment = Record<string, unknown> & {
  id: string;
  orderId: string;
  carrier: string;
  trackingNo?: string | null;
  trackingUrl?: string | null;
  shippedAt?: string | null;
  notifiedAt?: string | null;
  notifyText?: string | null;
};

type OrderLite = {
  id: string;
  orderNo?: string | null;
  recipientName?: string | null;
};

export default function ShipmentsPage() {
  const { carriers } = useCarriers();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [ordersById, setOrdersById] = useState<Record<string, OrderLite>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form — uses human-readable orderNo + optional search
  const [orderSearch, setOrderSearch] = useState('');
  const [orderResults, setOrderResults] = useState<OrderLite[]>([]);
  const [isSearchingOrders, setIsSearchingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderLite | null>(null);
  const [carrier, setCarrier] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await shipmentsApi.pendingNotify();
      const list = (res.data || []) as Shipment[];
      setShipments(list);

      const uniqueOrderIds = Array.from(new Set(list.map(s => s.orderId).filter(Boolean)));
      const orderResults = await Promise.all(
        uniqueOrderIds.map(async (id) => {
          try {
            const o = await ordersApi.byId(id);
            return [id, o.data as OrderLite] as const;
          } catch {
            return [id, { id }] as const;
          }
        }),
      );
      setOrdersById(Object.fromEntries(orderResults));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    return shipments
      .slice()
      .sort((a, b) => String(a.shippedAt || '').localeCompare(String(b.shippedAt || '')));
  }, [shipments]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await load(); }
    finally { setIsRefreshing(false); }
  };

  // Search shippable orders by order number
  const handleOrderSearch = async () => {
    if (!orderSearch.trim()) return;
    setIsSearchingOrders(true);
    setOrderResults([]);
    setSelectedOrder(null);
    try {
      const res = await shipmentsApi.shippableOrders(orderSearch.trim());
      const list = (res.data || []) as OrderLite[];
      if (list.length === 0) {
        toast('ไม่พบออร์เดอร์ที่ค้นหา', { icon: 'ℹ️' });
      }
      setOrderResults(list);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ค้นหาไม่สำเร็จ');
    } finally {
      setIsSearchingOrders(false);
    }
  };

  const resetCreateForm = () => {
    setOrderSearch('');
    setOrderResults([]);
    setSelectedOrder(null);
    setCarrier('');
    setTrackingNo('');
  };

  const handleCreate = async () => {
    if (!selectedOrder) { toast.error('กรุณาเลือกออร์เดอร์ก่อน'); return; }
    if (!carrier.trim()) { toast.error('กรุณาเลือกขนส่ง'); return; }

    setIsCreating(true);
    try {
      // Send orderNumber (human-readable), not UUID
      const res = await shipmentsApi.create({
        orderNumber: selectedOrder.orderNo || selectedOrder.id,
        carrier: carrier.trim(),
        trackingNumber: trackingNo.trim() || undefined,
      });
      const shipmentId = (res.data as { id: string }).id;
      if (trackingNo.trim()) {
        await shipmentsApi.updateTracking(shipmentId, trackingNo.trim());
      }
      toast.success('สร้างการจัดส่งแล้ว');
      setShowCreate(false);
      resetCreateForm();
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'สร้างไม่สำเร็จ');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyNotify = async (s: Shipment) => {
    const order = ordersById[s.orderId];
    const orderNo = order?.orderNo || '';
    const recipientName = order?.recipientName || '';
    if (!orderNo || !recipientName) {
      toast.error('ไม่พบข้อมูล orderNo/ชื่อผู้รับของออร์เดอร์นี้');
      return;
    }

    setBusyId(s.id);
    try {
      const res = await shipmentsApi.markNotified(s.id, { orderNo, recipientName });
      const notifyText = (res.data?.notifyText || '') as string;
      if (!notifyText) { toast.error('ไม่พบข้อความแจ้งลูกค้า'); return; }
      await navigator.clipboard.writeText(notifyText);
      toast.success('คัดลอกข้อความแล้ว และทำเครื่องหมายแจ้งแล้ว');
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Truck size={18} className="text-gray-400" />
          <h1 className="text-lg font-bold text-gray-900">จัดส่ง</h1>
          <span className="text-xs text-gray-400 mt-0.5">คิวรอแจ้งเลขพัสดุ</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowCreate(v => !v); if (showCreate) resetCreateForm(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${showCreate ? 'bg-orange-100 text-orange-600' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}>
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            {showCreate ? 'ปิด' : 'สร้างการจัดส่ง'}
          </button>
          <button onClick={handleRefresh} disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-lg text-sm transition">
            {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            รีเฟรช
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 space-y-3">
          {/* Step 1: Search order by number */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">ค้นหาออร์เดอร์ (เลขออร์เดอร์)</label>
              <div className="flex gap-2">
                <input
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleOrderSearch()}
                  placeholder="เช่น POS-20260422-..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 w-64"
                />
                <button onClick={handleOrderSearch} disabled={isSearchingOrders}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm disabled:opacity-50">
                  {isSearchingOrders ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  ค้นหา
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Select from results */}
          {orderResults.length > 0 && !selectedOrder && (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-w-lg">
              {orderResults.map(o => (
                <button key={o.id} onClick={() => setSelectedOrder(o)}
                  className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b last:border-0 border-gray-100 text-sm transition">
                  <span className="font-semibold text-gray-900">{o.orderNo}</span>
                  {o.recipientName && <span className="text-gray-400 ml-2">— {o.recipientName}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Selected order + carrier */}
          {selectedOrder && (
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">ออร์เดอร์ที่เลือก</label>
                <div className="flex items-center gap-2 border border-orange-300 bg-orange-50 rounded-lg px-3 py-2 text-sm">
                  <span className="font-semibold text-orange-700">{selectedOrder.orderNo}</span>
                  <button onClick={() => { setSelectedOrder(null); setOrderResults([]); }}
                    className="text-gray-400 hover:text-red-500 ml-1"><X size={13} /></button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">ขนส่ง *</label>
                <select value={carrier} onChange={e => setCarrier(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
                  <option value="">เลือก...</option>
                  {carriers.map(c => (
                    <option key={c.key} value={c.key}>{c.emoji} {c.name.th}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">Tracking No (ถ้ามี)</label>
                <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)}
                  placeholder="TH123456789"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 w-44" />
              </div>
              <button onClick={handleCreate} disabled={isCreating}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
                {isCreating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                สร้าง
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-gray-300">
              <Package size={32} strokeWidth={1} />
              <span className="text-sm">ไม่มีคิวรอแจ้ง</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">ออร์เดอร์</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">ผู้รับ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">ขนส่ง</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tracking</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">เวลาส่ง</th>
                  <th className="px-4 py-3 w-44" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const order = ordersById[s.orderId];
                  const busy = busyId === s.id;
                  const trackingNo = (s.trackingNo || '') as string;
                  const trackingUrl = (s.trackingUrl || '') as string;
                  return (
                    <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{order?.orderNo || '—'}</div>
                        <div className="text-xs text-gray-300 font-mono mt-0.5">{s.orderId}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-gray-800 font-medium">{order?.recipientName || '—'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
                          {s.carrier}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {trackingNo ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-700">{trackingNo}</span>
                            {trackingUrl && (
                              <a href={trackingUrl} target="_blank" rel="noreferrer"
                                className="text-xs text-blue-500 hover:text-blue-600 transition">
                                ติดตาม
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 tabular-nums whitespace-nowrap">
                        {s.shippedAt
                          ? new Date(String(s.shippedAt)).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => handleCopyNotify(s)} disabled={busy}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-xs font-semibold transition">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                          สร้างข้อความ + คัดลอก
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
