'use client';
import { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '@/lib/api';
import { BarChart2, Loader2 } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

type TopProduct = {
  productNameTh: string;
  totalQty: number;
  totalRevenue: number;
};

type DailyRow = {
  date: string;
  totalRevenue: number;
  totalOrders: number;
};

type PaymentRow = {
  paymentMethod: string;
  totalOrders: number;
  totalRevenue: number;
};

type ProfitRow = {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'เงินสด', qr: 'QR', transfer: 'โอน', cod: 'เก็บปลายทาง',
};

export default function ReportsPage() {
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailyRows,   setDailyRows]   = useState<DailyRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [profit,      setProfit]      = useState<ProfitRow | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [period, setPeriod] = useState({
    year:  new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const load = useCallback(() => {
    const from = new Date(period.year, period.month - 1, 1).toISOString().slice(0, 10);
    const to   = new Date(period.year, period.month,     0).toISOString().slice(0, 10);

    setIsLoading(true);

    Promise.all([
      reportsApi.topProducts(10, from, to),
      reportsApi.monthly(period.year, period.month).catch(() => ({ data: null })),
      reportsApi.profit(from, to).catch(() => ({ data: null })),
    ])
      .then(([topRes, dailyRes, profitRes]) => {
        setTopProducts((topRes.data as TopProduct[]) || []);

        const monthlyData = dailyRes.data as { rows?: DailyRow[]; byMethod?: PaymentRow[] } | DailyRow[] | null;
        if (Array.isArray(monthlyData)) {
          setDailyRows(monthlyData);
          setPaymentRows([]);
        } else if (monthlyData && Array.isArray(monthlyData.rows)) {
          setDailyRows(monthlyData.rows);
          setPaymentRows(monthlyData.byMethod || []);
        } else {
          setDailyRows([]);
          setPaymentRows([]);
        }

        setProfit((profitRes.data as ProfitRow | null) || null);
      })
      .catch(err => console.error('[Reports] load failed:', err))
      .finally(() => setIsLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // ─── Totals จาก dailyRows ──────────────────────────────────────
  const monthlyRevenue = dailyRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);
  const monthlyOrders  = dailyRows.reduce((s, r) => s + Number(r.totalOrders  || 0), 0);

  // ─── Chart options ─────────────────────────────────────────────

  const revenueOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dailyRows.map(r => r.date.slice(8)), // วัน DD
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      axisLabel: { formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v) },
    },
    series: [{
      name: 'ยอดขาย',
      data: dailyRows.map(r => r.totalRevenue),
      type: 'bar',
      barMaxWidth: 20,
      itemStyle: { color: '#f97316', borderRadius: [3, 3, 0, 0] },
    }],
    grid: { top: 12, right: 12, bottom: 28, left: 48 },
  };

  const topOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['จำนวน (ชิ้น)', 'ยอดขาย (฿)'], bottom: 0, textStyle: { fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: topProducts.map(p => p.productNameTh),
      axisLabel: { rotate: 30, fontSize: 10, interval: 0 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', name: 'ชิ้น',   splitLine: { lineStyle: { color: '#f3f4f6' } } },
      { type: 'value', name: '฿',      splitLine: { show: false } },
    ],
    series: [
      {
        name: 'จำนวน (ชิ้น)',
        type: 'bar', yAxisIndex: 0,
        data: topProducts.map(p => p.totalQty),
        barMaxWidth: 32,
        itemStyle: { color: '#f97316', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'ยอดขาย (฿)',
        type: 'line', yAxisIndex: 1,
        data: topProducts.map(p => p.totalRevenue),
        smooth: true,
        itemStyle: { color: '#3b82f6' },
      },
    ],
    grid: { top: 12, right: 48, bottom: 72, left: 48 },
  };

  const paymentOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: paymentRows.map(r => ({
        name: PAYMENT_LABEL[r.paymentMethod] || r.paymentMethod,
        value: Number(r.totalRevenue),
      })),
      itemStyle: { borderRadius: 4 },
      label: { fontSize: 11 },
    }],
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <BarChart2 size={18} className="text-gray-400" />
          <h1 className="text-lg font-bold text-gray-900">รายงาน</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period.month}
            onChange={e => setPeriod(p => ({ ...p, month: Number(e.target.value) }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>เดือน {i + 1}</option>
            ))}
          </select>
          <select
            value={period.year}
            onChange={e => setPeriod(p => ({ ...p, year: Number(e.target.value) }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
        </div>
      ) : (
        <>
          {/* Summary KPI */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'ยอดขายเดือนนี้',   value: `${monthlyRevenue.toLocaleString()} ฿`,   color: 'bg-emerald-50 text-emerald-700' },
              { label: 'จำนวนออเดอร์',     value: `${monthlyOrders.toLocaleString()} บิล`,  color: 'bg-blue-50 text-blue-700' },
              { label: 'เฉลี่ย/วัน',       value: `${dailyRows.length > 0 ? Math.round(monthlyRevenue / dailyRows.length).toLocaleString() : 0} ฿`, color: 'bg-orange-50 text-orange-700' },
              { label: 'กำไรขั้นต้น',      value: profit ? `${Number(profit.grossProfit).toLocaleString()} ฿` : '—', color: 'bg-purple-50 text-purple-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-4 ${color}`}>
                <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
                <div className="text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>

          {/* ยอดขายรายวัน */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">ยอดขายรายวัน</h3>
            {dailyRows.length > 0 ? (
              <ReactECharts option={revenueOption} style={{ height: 220 }} />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีข้อมูล</div>
            )}
          </div>

          {/* Top products + payment breakdown */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">สินค้าขายดี Top 10</h3>
              {topProducts.length > 0 ? (
                <ReactECharts option={topOption} style={{ height: 280 }} />
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">สัดส่วนวิธีชำระเงิน</h3>
              {paymentRows.length > 0 ? (
                <>
                  <ReactECharts option={paymentOption} style={{ height: 200 }} />
                  <div className="mt-3 space-y-1">
                    {paymentRows.map(r => (
                      <div key={r.paymentMethod} className="flex justify-between text-sm border-b border-gray-50 pb-1">
                        <span className="text-gray-600">{PAYMENT_LABEL[r.paymentMethod] || r.paymentMethod}</span>
                        <span className="font-semibold tabular-nums">{Number(r.totalRevenue).toLocaleString()} ฿ ({r.totalOrders} บิล)</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
