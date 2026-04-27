'use client';
import { useState, useEffect } from 'react';
import { auditApi } from '@/lib/api';
import { Search, Loader2, Shield } from 'lucide-react';

const ACTION_META: Record<string, { label: string; style: string }> = {
  STOCK_ADJUST:      { label: 'ปรับสต็อค',      style: 'bg-amber-50 text-amber-600 border-amber-200' },
  STOCK_RECEIVE:     { label: 'รับของเข้า',      style: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  PRICE_CHANGE:      { label: 'แก้ราคา',         style: 'bg-orange-50 text-orange-600 border-orange-200' },
  ORDER_CANCEL:      { label: 'ยกเลิกบิล',       style: 'bg-red-50 text-red-500 border-red-200' },
  ORDER_CREATE:      { label: 'สร้างออร์เดอร์',   style: 'bg-blue-50 text-blue-600 border-blue-200' },
  ORDER_RETURN:      { label: 'คืนสินค้า',       style: 'bg-pink-50 text-pink-600 border-pink-200' },
  PRODUCT_APPROVE:   { label: 'อนุมัติสินค้า',   style: 'bg-purple-50 text-purple-600 border-purple-200' },
  PRODUCT_CREATE:    { label: 'เพิ่มสินค้า',     style: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  PRODUCT_UPDATE:    { label: 'แก้ไขสินค้า',     style: 'bg-sky-50 text-sky-600 border-sky-200' },
  PRODUCT_DELETE:    { label: 'ลบสินค้า',        style: 'bg-gray-100 text-gray-500 border-gray-200' },
  BILL_VOID:         { label: 'ยกเลิกบิล',       style: 'bg-red-50 text-red-500 border-red-200' },
  WRONG_ITEM_PACKED: { label: 'ของตกสลับ',       style: 'bg-red-100 text-red-700 border-red-300' },
  USER_LOGIN:        { label: 'เข้าสู่ระบบ',     style: 'bg-gray-50 text-gray-500 border-gray-200' },
  USER_CREATE:       { label: 'สร้างผู้ใช้',      style: 'bg-teal-50 text-teal-600 border-teal-200' },
  USER_DEACTIVATE:   { label: 'ปิดผู้ใช้',       style: 'bg-red-50 text-red-500 border-red-200' },
  USER_ACTIVATE:     { label: 'เปิดผู้ใช้',      style: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
};

export default function AuditPage() {
  const [logs, setLogs]         = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter]     = useState({ action:'', from:'', to:'' });
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLogs(1); }, []);

  const loadLogs = async (p = page) => {
    setIsLoading(true);
    try {
      const res = await auditApi.list({
        action: filter.action || undefined,
        from:   filter.from   || undefined,
        to:     filter.to     || undefined,
        page:   p,
        limit:  100,
      });
      const body = res.data as { data: Record<string, unknown>[]; total: number; totalPages: number } | Record<string, unknown>[];
      if (Array.isArray(body)) {
        setLogs(body);
        setTotal(body.length);
        setTotalPages(1);
      } else {
        setLogs(body.data || []);
        setTotal(body.total || 0);
        setTotalPages(body.totalPages || 1);
      }
      setPage(p);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <Shield size={18} className="text-gray-400" />
          <h1 className="text-lg font-bold text-gray-900">Audit Log</h1>
          <span className="text-xs text-gray-400 mt-0.5">ประวัติการแก้ไขทั้งหมด</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0 flex-wrap">
        <select value={filter.action} onChange={e => setFilter(f=>({...f,action:e.target.value}))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white text-gray-700 min-w-40">
          <option value="">ทุกประเภท</option>
          {Object.entries(ACTION_META).map(([k,v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">จาก</span>
          <input type="date" value={filter.from} onChange={e => setFilter(f=>({...f,from:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
          <span className="text-xs text-gray-400">ถึง</span>
          <input type="date" value={filter.to} onChange={e => setFilter(f=>({...f,to:e.target.value}))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400" />
        </div>
        <button onClick={() => loadLogs(1)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm transition">
          <Search size={14} />
          ค้นหา
        </button>
        {(filter.action || filter.from || filter.to) && (
          <button onClick={() => { setFilter({ action:'', from:'', to:'' }); setTimeout(() => loadLogs(1), 0); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition">
            ล้างตัวกรอง
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{total.toLocaleString()} รายการ</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">เวลา</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">ผู้ใช้</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">การกระทำ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">เหตุผล</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ค่าที่เปลี่ยน</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-14">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
                  </div>
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-14">
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <Shield size={32} strokeWidth={1} />
                    <span className="text-sm">ไม่พบข้อมูล</span>
                  </div>
                </td></tr>
              ) : logs.map((log) => {
                const action = log.action as string;
                const meta = ACTION_META[action] || { label: action, style: 'bg-gray-100 text-gray-500 border-gray-200' };
                const user = log.user as Record<string, string> | undefined;
                return (
                  <tr key={log.id as string} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">
                      {new Date(log.createdAt as string).toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' })}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-700 text-sm">{user?.nameTh || user?.username || '—'}</div>
                      <div className="text-xs text-gray-400 capitalize mt-0.5">{user?.role}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${meta.style}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 max-w-48">
                      <span className="truncate block" title={log.reason as string}>{log.reason ? String(log.reason) : <span className="text-gray-300">—</span>}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-mono max-w-64">
                      {(log.oldValue != null || log.newValue != null) ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.oldValue != null && (
                            <span
                              className="text-red-400 bg-red-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-100 transition"
                              title={JSON.stringify(log.oldValue, null, 2)}
                              onClick={() => alert(JSON.stringify(log.oldValue, null, 2))}
                            >
                              {JSON.stringify(log.oldValue).slice(0, 40)}{JSON.stringify(log.oldValue).length > 40 ? '…' : ''}
                            </span>
                          )}
                          {log.oldValue != null && log.newValue != null && <span className="text-gray-300">→</span>}
                          {log.newValue != null && (
                            <span
                              className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-emerald-100 transition"
                              title={JSON.stringify(log.newValue, null, 2)}
                              onClick={() => alert(JSON.stringify(log.newValue, null, 2))}
                            >
                              {JSON.stringify(log.newValue).slice(0, 40)}{JSON.stringify(log.newValue).length > 40 ? '…' : ''}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-gray-200">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => loadLogs(page - 1)}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
            >
              ← ก่อนหน้า
            </button>
            <span className="text-xs text-gray-500">หน้า {page} / {totalPages}</span>
            <button
              onClick={() => loadLogs(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
