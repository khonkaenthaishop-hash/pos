'use client';
import { useState, useEffect } from 'react';
import { ordersApi, reportsApi, productsApi } from '@/lib/api';
import { TrendingUp, ShoppingCart, DollarSign, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

type DailySummary = {
  date: string;
  totalRevenue: number;
  totalOrders: number;
};

type TopProduct = {
  productNameTh: string;
  totalQty: number;
  totalRevenue: number;
};

type LowStockItem = {
  nameTh: string;
  currentStock: number;
  minStock: number;
};

type TodayRow = {
  type: string;
  totalOrders: string;
  totalRevenue: string;
};

export default function DashboardPage() {
  const [todayRevenue, setTodayRevenue]   = useState(0);
  const [todayOrders,  setTodayOrders]    = useState(0);
  const [dailyTrend,   setDailyTrend]     = useState<DailySummary[]>([]);
  const [topProducts,  setTopProducts]    = useState<TopProduct[]>([]);
  const [lowStock,     setLowStock]       = useState<LowStockItem[]>([]);
  const [isLoading,    setIsLoading]      = useState(true);
  const [lastUpdated,  setLastUpdated]    = useState<Date | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const from  = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);

      const [todayRes, dailyRes, topRes, lowRes] = await Promise.all([
        ordersApi.todaySummary(),
        reportsApi.daily(today).catch(() => ({ data: [] })),
        reportsApi.topProducts(5, from, today),
        productsApi.lowStock(),
      ]);

      const rows: TodayRow[] = (todayRes.data as TodayRow[]) || [];
      setTodayRevenue(rows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0));
      setTodayOrders(rows.reduce((s, r)  => s + Number(r.totalOrders  || 0), 0));

      const dailyRaw = (dailyRes.data as DailySummary[] | null) || [];
      setDailyTrend(Array.isArray(dailyRaw) ? dailyRaw : []);

      setTopProducts((topRes.data as TopProduct[]) || []);
      setLowStock((lowRes.data as LowStockItem[]) || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[Dashboard] load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Chart options ─────────────────────────────────────────────

  const trendOption = {
    tooltip: { trigger: 'axis', formatter: (p: { name: string; value: number }[]) => `${p[0].name}<br/>฿${Number(p[0].value).toLocaleString()}` },
    xAxis: {
      type: 'category',
      data: dailyTrend.map(d => d.date.slice(5)), // MM-DD
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f3f4f6' } }, axisLabel: { formatter: (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v) } },
    series: [{
      data: dailyTrend.map(d => d.totalRevenue),
      type: 'bar',
      barMaxWidth: 40,
      itemStyle: { color: '#f97316', borderRadius: [4, 4, 0, 0] },
      label: { show: false },
    }],
    grid: { top: 12, right: 12, bottom: 28, left: 48 },
  };

  const topOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: topProducts.map(p => p.productNameTh),
      axisLabel: { fontSize: 10, interval: 0, rotate: topProducts.some(p => p.productNameTh.length > 6) ? 20 : 0 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      data: topProducts.map(p => p.totalQty),
      type: 'bar',
      barMaxWidth: 48,
      itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
    }],
    grid: { top: 12, right: 12, bottom: 48, left: 40 },
  };

  // ─── KPI cards ─────────────────────────────────────────────────

  const kpis = [
    {
      label: 'ยอดขายวันนี้',
      value: `${todayRevenue.toLocaleString()} ฿`,
      icon: DollarSign,
      color: 'border-emerald-500 text-emerald-600',
    },
    {
      label: 'จำนวนออเดอร์',
      value: todayOrders,
      icon: ShoppingCart,
      color: 'border-blue-500 text-blue-600',
    },
    {
      label: 'เฉลี่ย/ออเดอร์',
      value: todayOrders > 0 ? `${Math.round(todayRevenue / todayOrders).toLocaleString()} ฿` : '—',
      icon: TrendingUp,
      color: 'border-orange-500 text-orange-600',
    },
    {
      label: 'สินค้าใกล้หมด',
      value: lowStock.length,
      icon: AlertTriangle,
      color: 'border-red-500 text-red-600',
    },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={20} className="animate-spin" /> กำลังโหลด...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">แดชบอร์ด</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              อัปเดต {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <RefreshCw size={12} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-white rounded-xl border-l-4 p-4 shadow-sm ${color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{label}</span>
              <Icon size={16} className="opacity-60" />
            </div>
            <div className="text-2xl font-bold text-gray-800">{value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ยอดขาย 7 วัน */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">ยอดขาย 7 วันล่าสุด</h3>
          {dailyTrend.length > 0 ? (
            <ReactECharts option={trendOption} style={{ height: 200 }} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีข้อมูล</div>
          )}
        </div>

        {/* Top 5 สินค้า */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">สินค้าขายดี Top 5 (7 วัน)</h3>
          {topProducts.length > 0 ? (
            <ReactECharts option={topOption} style={{ height: 200 }} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีข้อมูล</div>
          )}
        </div>

        {/* สต็อกต่ำ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm xl:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">สินค้าสต็อกต่ำ</h3>
          {lowStock.length === 0 ? (
            <div className="h-20 flex items-center justify-center text-gray-300 text-sm">สต็อกปกติทั้งหมด ✓</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {lowStock.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-700 truncate flex-1 mr-2">{p.nameTh}</span>
                  <span className={`font-bold tabular-nums shrink-0 ${p.currentStock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                    {p.currentStock} ชิ้น
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
