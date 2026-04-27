// ==========================================
// ร้านขอนแก่น — Carrier Configuration
// ==========================================

export type CarrierKey =
  | 'seven_eleven'
  | 'family_mart'
  | 'ok_mart'
  | 'hilife'
  | 'black_cat'
  | 'post';

export type TemperatureType = 'normal' | 'cold' | 'frozen';
export type PackageSize = 'small' | 'medium' | 'large';

export interface CarrierRate {
  price: number;
  price_max?: number;  // กรณีมี range
  cod_available: boolean;
  cod_limit?: number;
  cod_extra_fee?: number;
  weight_limit_kg?: number;
}

export interface CarrierConfig {
  key: CarrierKey;
  name: { th: string; zh: string; en: string };
  emoji: string;
  tracking_url: string;
  map_url: string | null;
  auto_append_tracking: boolean;
  tracking_format: RegExp | null;
  tracking_placeholder: string;
  has_cold: boolean;
  has_map: boolean;
  delivery_days: string;
  rates: {
    normal?: {
      default?: CarrierRate;
      small?: CarrierRate;
      medium?: CarrierRate;
      large?: CarrierRate;
    };
    cold?: {
      default?: CarrierRate;
      small?: CarrierRate;
      medium?: CarrierRate;
      large?: CarrierRate;
    };
  };
}

export const CARRIERS: Record<CarrierKey, CarrierConfig> = {
  seven_eleven: {
    key: 'seven_eleven',
    name: { th: '7-Eleven', zh: '統一超商', en: '7-Eleven' },
    emoji: '🟠',
    tracking_url: 'https://eservice.7-11.com.tw/e-tracking/search.aspx',
    map_url: 'https://emap.pcsc.com.tw/emap.aspx',
    auto_append_tracking: false,
    tracking_format: /^R\d{11}$/,
    tracking_placeholder: 'R57489177206',
    has_cold: true,
    has_map: true,
    delivery_days: '3-5 วัน',
    rates: {
      normal: { default: { price: 70,  cod_available: true,  cod_limit: 20000, weight_limit_kg: 5  } },
      cold:   { default: { price: 150, cod_available: true,  cod_limit: 20000, weight_limit_kg: 10 } },
    },
  },

  family_mart: {
    key: 'family_mart',
    name: { th: 'Family Mart', zh: '全家便利商店', en: 'FamilyMart' },
    emoji: '🟢',
    tracking_url: 'https://fmec.famiport.com.tw/FP_Entrance/QueryBox?orderno=',
    map_url: 'https://www.family.com.tw/Marketing/th/Map',
    auto_append_tracking: true,
    tracking_format: /^\d{11}$/,
    tracking_placeholder: '16335887405',
    has_cold: true,
    has_map: true,
    delivery_days: '3-5 วัน',
    rates: {
      normal: { default: { price: 80,  cod_available: true, cod_limit: 5000, weight_limit_kg: 5  } },
      cold:   { default: { price: 150, cod_available: true, cod_limit: 5000, weight_limit_kg: 10 } },
    },
  },

  ok_mart: {
    key: 'ok_mart',
    name: { th: 'OK Mart', zh: 'OK超商', en: 'OK Mart' },
    emoji: '🔴',
    tracking_url: 'https://ecservice.okmart.com.tw/Tracking/Search',
    map_url: 'https://www.okmart.com.tw/convenient_shopSearch_express',
    auto_append_tracking: false,
    tracking_format: null,
    tracking_placeholder: 'กรอกเลขพัสดุ',
    has_cold: true,
    has_map: true,
    delivery_days: '3-5 วัน',
    rates: {
      normal: { default: { price: 70,  cod_available: true, cod_limit: 5000 } },
      cold:   { default: { price: 150, cod_available: true, cod_limit: 5000 } },
    },
  },

  hilife: {
    key: 'hilife',
    name: { th: 'Hi-Life', zh: '萊爾富', en: 'Hi-Life' },
    emoji: '🔵',
    tracking_url: 'https://www.hilife.com.tw/serviceInfo_search.aspx',
    map_url: null,
    auto_append_tracking: false,
    tracking_format: null,
    tracking_placeholder: 'กรอกเลขพัสดุ',
    has_cold: false,   // ❌ ไม่มีบริการเย็น
    has_map: false,
    delivery_days: '-',
    rates: {
      normal: { default: { price: 70, cod_available: false, cod_limit: 0 } },
    },
  },

  black_cat: {
    key: 'black_cat',
    name: { th: 'แมวดำ', zh: '黑貓宅急便', en: 'T-CAT' },
    emoji: '🐱',
    tracking_url: 'https://www.t-cat.com.tw/Inquire/Trace.aspx',
    map_url: null,
    auto_append_tracking: false,
    tracking_format: /^\d{4}-\d{4}-\d{4}$/,
    tracking_placeholder: '6050-5172-4974',
    has_cold: true,
    has_map: false,
    delivery_days: '1 วัน',
    rates: {
      normal: {
        small:  { price: 130, cod_available: true, weight_limit_kg: 1  },
        medium: { price: 170, cod_available: true, weight_limit_kg: 20 },
        large:  { price: 210, price_max: 250, cod_available: true, weight_limit_kg: 20 },
      },
      cold: {
        small:  { price: 160, cod_available: true, weight_limit_kg: 1  },
        medium: { price: 225, cod_available: true, weight_limit_kg: 20 },
        large:  { price: 290, price_max: 350, cod_available: true, weight_limit_kg: 20 },
      },
    },
  },

  post: {
    key: 'post',
    name: { th: 'ไปรษณีย์', zh: '中華郵政', en: 'Taiwan Post' },
    emoji: '📮',
    tracking_url: 'https://postserv.post.gov.tw/pstmail/main_mail.html?targetTxn=',
    map_url: null,
    auto_append_tracking: true,
    tracking_format: null,
    tracking_placeholder: 'กรอกเลขพัสดุ',
    has_cold: false,   // ❌ ไม่มีบริการเย็น
    has_map: false,
    delivery_days: '-',
    rates: {
      normal: {
        small:  { price: 100, cod_available: true, cod_extra_fee: 30 },
        medium: { price: 150, cod_available: true, cod_extra_fee: 30 },
        large:  { price: 200, cod_available: true, cod_extra_fee: 30 },
      },
    },
  },
};

// ==========================================
// Helper Functions
// ==========================================

export function getShippingPrice(
  carrier: CarrierKey,
  temperature: TemperatureType,
  size?: PackageSize,
): CarrierRate | null {
  const config = CARRIERS[carrier];
  const tempRates = config.rates[temperature === 'frozen' ? 'cold' : temperature];
  if (!tempRates) return null;

  if (size && tempRates[size]) return tempRates[size]!;
  return tempRates.default || null;
}

export function getTrackingUrl(carrier: CarrierKey, trackingNo: string): string {
  const config = CARRIERS[carrier];
  if (config.auto_append_tracking) {
    return config.tracking_url + trackingNo;
  }
  return config.tracking_url;
}

export function validateTracking(carrier: CarrierKey, trackingNo: string): boolean {
  const format = CARRIERS[carrier].tracking_format;
  if (!format) return trackingNo.length > 0;
  return format.test(trackingNo);
}

export function isCodAvailable(
  carrier: CarrierKey,
  temperature: TemperatureType,
  orderTotal: number,
  size?: PackageSize,
): { available: boolean; reason?: string } {
  const rate = getShippingPrice(carrier, temperature, size);
  if (!rate) return { available: false, reason: 'ไม่พบข้อมูลค่าส่ง' };
  if (!rate.cod_available) return { available: false, reason: 'ขนส่งนี้ไม่รองรับเก็บปลายทาง' };
  if (rate.cod_limit && orderTotal > rate.cod_limit) {
    return { available: false, reason: `ยอดเกิน ${rate.cod_limit.toLocaleString()} NT$ สูงสุดสำหรับ COD` };
  }
  return { available: true };
}

export const CARRIER_LIST = Object.values(CARRIERS);
