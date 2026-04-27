/**
 * Unit tests — cart & payment calculation logic
 * ทดสอบ subtotal, discount, VAT, change calculation
 * (logic เดียวกับที่ใช้ใน pos/page.tsx)
 */

// ─── Pure calculation functions (extracted for testing) ────────

function round2(n: number): number {
  return Number(Number(n).toFixed(2));
}

function calcSubtotal(items: { retailPrice: number; qty: number; itemDiscount: number }[]): number {
  return items.reduce((s, i) => s + (i.retailPrice * i.qty) - i.itemDiscount, 0);
}

function calcVat(base: number, rate: number): number {
  return Number((base * rate).toFixed(2));
}

function calcNet(subtotal: number, discount: number, vatRate: number): number {
  const base = Math.max(0, subtotal - discount);
  const vat  = calcVat(base, vatRate);
  return Number((base + vat).toFixed(2));
}

function calcChange(received: number, net: number): number {
  return Math.max(0, received - net);
}

function computePromoDiscount(
  unitQty: number, retailPrice: number,
  promoQty: number | null, promoPrice: number | null,
): number {
  const q  = Math.floor(Number(unitQty) || 0);
  const pq = promoQty != null ? Math.floor(Number(promoQty) || 0) : 0;
  const pp = promoPrice != null ? Number(promoPrice) : NaN;
  if (q <= 0 || pq <= 1 || !Number.isFinite(pp) || pp <= 0) return 0;
  const bundles = Math.floor(q / pq);
  if (bundles <= 0) return 0;
  const normal = bundles * pq * retailPrice;
  const promo  = bundles * pp;
  return Math.max(0, round2(normal - promo));
}

// ─── Subtotal ─────────────────────────────────────────────────

describe('calcSubtotal', () => {
  it('sums items correctly', () => {
    const items = [
      { retailPrice: 10, qty: 2, itemDiscount: 0 },
      { retailPrice: 25, qty: 1, itemDiscount: 0 },
    ];
    expect(calcSubtotal(items)).toBe(45);
  });

  it('applies item-level discount', () => {
    const items = [{ retailPrice: 100, qty: 1, itemDiscount: 20 }];
    expect(calcSubtotal(items)).toBe(80);
  });

  it('handles empty cart', () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it('handles zero-price items', () => {
    const items = [{ retailPrice: 0, qty: 5, itemDiscount: 0 }];
    expect(calcSubtotal(items)).toBe(0);
  });

  it('handles high qty correctly', () => {
    const items = [{ retailPrice: 7, qty: 100, itemDiscount: 0 }];
    expect(calcSubtotal(items)).toBe(700);
  });
});

// ─── VAT ─────────────────────────────────────────────────────

describe('calcVat', () => {
  it('calculates 7% VAT correctly', () => {
    expect(calcVat(100, 0.07)).toBe(7);
  });

  it('rounds to 2 decimal places', () => {
    expect(calcVat(33.33, 0.07)).toBe(2.33);
  });

  it('returns 0 when rate is 0', () => {
    expect(calcVat(999, 0)).toBe(0);
  });
});

// ─── Net total ────────────────────────────────────────────────

describe('calcNet', () => {
  it('computes net with no discount, no VAT', () => {
    expect(calcNet(100, 0, 0)).toBe(100);
  });

  it('applies bill-level discount before VAT', () => {
    // base = 100 - 10 = 90, vat = 90 * 0.07 = 6.30, net = 96.30
    expect(calcNet(100, 10, 0.07)).toBe(96.30);
  });

  it('discount cannot make base negative', () => {
    // discount > subtotal → base clamped to 0
    expect(calcNet(50, 100, 0.07)).toBe(0);
  });

  it('handles fractional prices', () => {
    const net = calcNet(33.33, 3.33, 0.07);
    expect(net).toBeCloseTo(32.14, 1);
  });
});

// ─── Change calculation ───────────────────────────────────────

describe('calcChange', () => {
  it('returns correct change', () => {
    expect(calcChange(100, 44)).toBe(56);
  });

  it('returns 0 when exact payment', () => {
    expect(calcChange(44, 44)).toBe(0);
  });

  it('returns 0 when underpaid (not negative)', () => {
    expect(calcChange(40, 44)).toBe(0);
  });

  it('handles large amounts', () => {
    expect(calcChange(1000, 278.20)).toBeCloseTo(721.80, 2);
  });
});

// ─── Promo discount ───────────────────────────────────────────

describe('computePromoDiscount', () => {
  it('calculates bundle discount', () => {
    // 3 for 20 — buy 6 → 2 bundles, normal = 6*7=42, promo = 2*20=40, discount=2
    expect(computePromoDiscount(6, 7, 3, 20)).toBe(2);
  });

  it('ignores leftover units outside bundle', () => {
    // buy 7, promo 3-for-20 → 2 bundles (6 units), 1 leftover
    expect(computePromoDiscount(7, 7, 3, 20)).toBe(2);
  });

  it('returns 0 when promoQty <= 1', () => {
    expect(computePromoDiscount(5, 10, 1, 8)).toBe(0);
  });

  it('returns 0 when promoQty is null', () => {
    expect(computePromoDiscount(5, 10, null, 8)).toBe(0);
  });

  it('returns 0 when promoPrice is null', () => {
    expect(computePromoDiscount(5, 10, 3, null)).toBe(0);
  });

  it('returns 0 when unitQty = 0', () => {
    expect(computePromoDiscount(0, 10, 3, 25)).toBe(0);
  });

  it('discount is never negative', () => {
    // promo price > normal price — should return 0
    expect(computePromoDiscount(3, 5, 3, 99)).toBe(0);
  });
});

// ─── Edge cases ───────────────────────────────────────────────

describe('payment edge cases', () => {
  it('500+ SKU total sums correctly', () => {
    const items = Array.from({ length: 500 }, () => ({
      retailPrice: 9.99,
      qty: 1,
      itemDiscount: 0,
    }));
    const subtotal = calcSubtotal(items);
    expect(subtotal).toBeCloseTo(4995, 0);
  });

  it('order with only free items (price=0) produces net=0', () => {
    const items = Array.from({ length: 5 }, () => ({
      retailPrice: 0, qty: 2, itemDiscount: 0,
    }));
    expect(calcNet(calcSubtotal(items), 0, 0.07)).toBe(0);
  });

  it('maximum discount equals subtotal produces net=0', () => {
    const subtotal = 999;
    expect(calcNet(subtotal, subtotal, 0.07)).toBe(0);
  });
});
