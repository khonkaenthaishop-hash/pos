import axios from "axios";
import { getSession, signOut } from "next-auth/react";

const api = axios.create({
  baseURL:
    (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api/v1",
  timeout: 15000,
});

// In-memory token cache only — never stored in localStorage (XSS risk)
let cachedSessionAccessToken: string | null = null;
let lastSessionFetchMs = 0;
const SESSION_TOKEN_CACHE_MS = 5_000;

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const now = Date.now();
  if (
    cachedSessionAccessToken &&
    now - lastSessionFetchMs < SESSION_TOKEN_CACHE_MS
  ) {
    return cachedSessionAccessToken;
  }

  try {
    const session = await getSession();
    const token = (session as unknown as Record<string, unknown>)
      ?.accessToken as string | undefined;
    cachedSessionAccessToken = token?.trim() ? token : null;
    lastSessionFetchMs = now;
    return cachedSessionAccessToken;
  } catch {
    return null;
  }
}

// Request interceptor — แนบ token
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — จัดการ 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      // Clear in-memory token cache
      cachedSessionAccessToken = null;
      lastSessionFetchMs = 0;

      // Sign out via NextAuth (clears httpOnly cookie) and redirect to login
      await signOut({ callbackUrl: "/login", redirect: true });
    }
    return Promise.reject(err);
  },
);

// ── Auth ─────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post("/auth/login", { username, password }),
  me: () => api.get("/auth/me"),
  /** Server-side check: returns 200 if caller is manager/owner, 401 otherwise */
  verifyManager: () => api.post("/auth/verify-manager"),
};

// ── Products ─────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: Record<string, unknown>) => api.get("/products", { params }),
  byBarcode: (barcode: string, params?: Record<string, unknown>) =>
    api.get(`/products/barcode/${barcode}`, params ? { params } : undefined),
  byId: (id: string) => api.get(`/products/${id}`),
  create: (data: Record<string, unknown>) => api.post("/products", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/products/${id}`, data),
  remove: (id: string) => api.delete(`/products/${id}`),
  toggleActive: (id: string) => api.patch(`/products/${id}/toggle-active`),
  approve: (id: string) => api.patch(`/products/${id}/approve`),
  updatePrice: (id: string, data: Record<string, unknown>) =>
    api.patch(`/products/${id}/price`, data),
  adjustStock: (id: string, data: Record<string, unknown>) =>
    api.patch(`/products/${id}/stock`, data),
  lowStock: () => api.get("/products/low-stock"),
};

// ── Categories ───────────────────────────────────────────────────
export const categoriesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get("/categories", { params }),
  create: (data: Record<string, unknown>) => api.post("/categories", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/categories/${id}`, data),
  remove: (id: string) => api.delete(`/categories/${id}`),
};

// ── Orders ───────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: Record<string, unknown>) => api.get("/orders", { params }),
  byId: (id: string) => api.get(`/orders/${id}`),
  byOrderNo: (orderNo: string) => api.get(`/orders/by-no/${encodeURIComponent(orderNo)}`),
  createPos: (data: Record<string, unknown>) => api.post("/orders/pos", data),
  createOnline: (data: Record<string, unknown>) =>
    api.post("/orders/online", data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
  cancel: (id: string, reason: string) =>
    api.patch(`/orders/${id}/cancel`, { reason }),
  checkItem: (orderId: string, itemId: string) =>
    api.patch(`/orders/${orderId}/items/${itemId}/check`),
  todaySummary: () => api.get("/orders/today-summary"),
  // Opening cash
  openCash: (amount: number) =>
    api.post("/orders/open-cash", { amount, date: new Date().toISOString().slice(0, 10) }),
  getOpenCash: (date: string) =>
    api.get("/orders/open-cash", { params: { date } }),
  // X/Z Reports
  xReport: (date: string) => api.get("/orders/report/x", { params: { date } }),
  zReport: (date: string) => api.get("/orders/report/z", { params: { date } }),
  // Slip
  saveSlip: (id: string, slipUrl: string) =>
    api.patch(`/orders/${id}/slip`, { slipUrl }),
  // Return
  returnOrder: (id: string, reason: string) =>
    api.post(`/orders/${id}/return`, { reason }),
};

// ── Held Orders ──────────────────────────────────────────────────
export const heldOrdersApi = {
  /** List summaries (no cart JSON) */
  list: (all?: boolean) =>
    api.get("/held-orders", { params: all ? { all: "true" } : undefined }),
  /** Get full record including cart */
  getById: (id: string) => api.get(`/held-orders/${id}`),
  /** Save cart as held order */
  hold: (data: {
    label?: string;
    customerId?: string;
    customerName?: string;
    cart: Record<string, unknown>[];
    discount?: number;
    note?: string;
  }) => api.post("/held-orders", data),
  /** Resume (returns full record + deletes it) */
  resume: (id: string) => api.post(`/held-orders/${id}/resume`),
  /** Permanently discard */
  discard: (id: string) => api.delete(`/held-orders/${id}`),
};

// ── Customers ────────────────────────────────────────────────────
export const customersApi = {
  list: (search?: string, page?: number, limit?: number) =>
    api.get("/customers", { params: { search, page, limit } }),
  byId: (id: string) => api.get(`/customers/${id}`),
  create: (data: Record<string, unknown>) => api.post("/customers", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/customers/${id}`, data),
  remove: (id: string) => api.delete(`/customers/${id}`),
};

// ── Shipments ────────────────────────────────────────────────────
export const shipmentsApi = {
  create: (data: Record<string, unknown>) => api.post("/shipments", data),
  updateTracking: (id: string, trackingNo: string) =>
    api.patch(`/shipments/${id}/tracking`, { trackingNo }),
  markNotified: (id: string, data: Record<string, unknown>) =>
    api.patch(`/shipments/${id}/notify`, data),
  byOrder: (orderId: string) => api.get(`/shipments/order/${orderId}`),
  pendingNotify: () => api.get("/shipments/pending-notify"),
  /** Search orders that are eligible to be shipped (PENDING / CONFIRMED status) */
  shippableOrders: (search?: string) =>
    api.get("/shipments/shippable-orders", { params: { search } }),
};

// ── Reports ──────────────────────────────────────────────────────
export const reportsApi = {
  daily: (date?: string) => api.get("/reports/daily", { params: { date } }),
  monthly: (year: number, month: number) =>
    api.get("/reports/monthly", { params: { year, month } }),
  topProducts: (limit = 10, from?: string, to?: string) =>
    api.get("/reports/top-products", { params: { limit, from, to } }),
  slowProducts: () => api.get("/reports/slow-products"),
  reorder: () => api.get("/reports/reorder"),
  profit: (from: string, to: string) =>
    api.get("/reports/profit", { params: { from, to } }),
};

// ── Inventory ────────────────────────────────────────────────────
export const inventoryApi = {
  reasonCodes: (type?: string) =>
    api.get("/inventory/reason-codes", { params: { type } }),
  transactions: (params?: Record<string, unknown>) =>
    api.get("/inventory/transactions", { params }),
  receive: (data: Record<string, unknown>) =>
    api.post("/inventory/receive", data),
  adjust: (data: Record<string, unknown>) =>
    api.post("/inventory/adjust", data),
  discard: (data: Record<string, unknown>) =>
    api.post("/inventory/discard", data),
  discardSummary: (year: number, month: number) =>
    api.get("/inventory/discard-summary", { params: { year, month } }),
  suppliers: () => api.get("/inventory/suppliers"),
  createSupplier: (data: Record<string, unknown>) =>
    api.post("/inventory/suppliers", data),
  updateSupplier: (id: string, data: Record<string, unknown>) =>
    api.patch(`/inventory/suppliers/${id}`, data),
};

// ── Carriers ─────────────────────────────────────────────────────
export const carriersApi = {
  list: () => api.get("/carriers"),
  byKey: (key: string) => api.get(`/carriers/${key}`),
};

// ── Audit ────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: Record<string, unknown>) => api.get("/audit", { params }),
  summary: () => api.get("/audit/summary"),
};

// ── Users ────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get("/users"),
  create: (data: Record<string, unknown>) => api.post("/users", data),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
  activate: (id: string) => api.patch(`/users/${id}/activate`),
};

// ── Cashier Sessions ─────────────────────────────────────────────
export const cashierSessionsApi = {
  /** Returns today's session or null if none exists */
  getToday: () => api.get('/cashier-sessions/today'),
  /** Open a session. 409 if already open today */
  open: (openingAmount: number, note?: string) =>
    api.post('/cashier-sessions/open', { openingAmount, note }),
  /** Close today's session */
  close: (closingAmount: number, note?: string) =>
    api.post('/cashier-sessions/close', { closingAmount, note }),
  /** Manager: list sessions */
  list: (from?: string, to?: string) =>
    api.get('/cashier-sessions', { params: { from, to } }),
};

// ── Locations ────────────────────────────────────────────────────
export const locationsApi = {
  list: () => api.get("/locations"),
  getProductLocations: (productId: string) =>
    api.get(`/products/${productId}/locations`),
  updateProductLocations: (
    productId: string,
    items: { locationId: number; quantity: number; priority?: number }[]
  ) => api.patch(`/products/${productId}/locations`, items),
};

// ── Settings ─────────────────────────────────────────────────────
export const settingsApi = {
  get: (group: string) => api.get(`/settings/${group}`),
  update: (group: string, data: Record<string, unknown>) =>
    api.patch(`/settings/${group}`, data),
  listWarehouses: () => api.get('/settings/warehouses'),
  createWarehouse: (data: Record<string, unknown>) =>
    api.post('/settings/warehouses', data),
  updateWarehouse: (id: string, data: Record<string, unknown>) =>
    api.patch(`/settings/warehouses/${id}`, data),
  deleteWarehouse: (id: string) =>
    api.delete(`/settings/warehouses/${id}`),
  clearCache: () => api.post('/settings/system/clear-cache'),
  exportData: () =>
    api.get('/settings/system/export', { responseType: 'blob' }),
};

export default api;
