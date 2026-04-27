/**
 * Test data generators — deterministic, seed-based
 */

import type { ReceiptData } from "@/lib/escpos/receiptFormatter";

export const STORE = {
  shopName: "KHONKAEN TEST SHOP",
  address: "123 Test Road, Bangkok",
  tel: "0999999999",
  footerLines: ["Thank you for your purchase"],
} as const;

/** Create basic ReceiptData */
export function makeReceiptData(
  overrides: Partial<ReceiptData> = {},
): ReceiptData {
  return {
    ...STORE,
    footerLines: [...STORE.footerLines],
    receiptNo: "TEST-0001",
    issuedAt: new Date("2026-01-15T10:30:00.000Z"),
    cashierName: "Cashier A",
    items: [
      { name: "Instant Noodle Spicy", qty: 2, price: 7 },
      { name: "Fish Sauce Small",     qty: 1, price: 25 },
    ],
    total: 39,
    cash: 50,
    change: 11,
    ...overrides,
  };
}

/** Create n test items */
export function makeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    name:  `Test Product ${String(i + 1).padStart(3, "0")}`,
    qty:   (i % 5) + 1,
    price: ((i + 1) * 13) % 500 || 10,
  }));
}

/** Create cart items for checkout testing */
export function makeCartItems(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    id:           `prod_${i + 1}`,
    nameTh:       `Product ${i + 1}`,
    retailPrice:  (i + 1) * 10,
    qty:          i + 1,
    itemDiscount: 0,
  }));
}

/** Calculate subtotal from cart items */
export function calcSubtotal(items: ReturnType<typeof makeCartItems>): number {
  return items.reduce((s, i) => s + i.retailPrice * i.qty - i.itemDiscount, 0);
}

export const LONG_THAI_NAME = "Extra Large Special Fish Sauce Big Bottle Premium Quality";
export const LONG_ENG_NAME  = "Extra Large Special Fish Sauce Bottle Premium";
export const EXACT_24_NAME  = "Fish Sauce 24 Chars Name";
