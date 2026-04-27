import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export type ProductScanMeta = {
  kind: 'unit' | 'pack';
  unit: string;
  ratio: number;
  barcode: string;
};

export function getProductScanMeta(product: unknown): ProductScanMeta | null {
  if (!isRecord(product)) return null;
  const scan = product.scan;
  if (!isRecord(scan)) return null;
  const kind = scan.kind;
  if (kind !== 'unit' && kind !== 'pack') return null;
  const unit = typeof scan.unit === 'string' ? scan.unit : '';
  const barcode = typeof scan.barcode === 'string' ? scan.barcode : '';
  const ratioRaw = scan.ratio;
  const ratio = Number(ratioRaw);
  return {
    kind,
    unit,
    barcode,
    ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1,
  };
}
