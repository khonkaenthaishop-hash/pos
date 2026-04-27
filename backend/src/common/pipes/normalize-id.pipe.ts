import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validate as validateUuid } from 'uuid';

function isIdKey(key: string): boolean {
  return key === 'id' || key.endsWith('Id');
}

function normalizeIdValue(value: unknown, keyForError: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!validateUuid(trimmed)) throw new BadRequestException(`Invalid ${keyForError}`);
  return trimmed;
}

function normalizeIdsDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeIdsDeep);
  if (!value || typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const normalizedChild = normalizeIdsDeep(val);
    out[key] = isIdKey(key) ? normalizeIdValue(normalizedChild, key) : normalizedChild;
  }
  return out;
}

@Injectable()
export class NormalizeIdPipe implements PipeTransform {
  transform(value: any, metadata: { type?: string; data?: string }) {
    // For query/param primitives, treat empty string as "not provided" for *Id fields.
    if ((metadata?.type === 'query' || metadata?.type === 'param') && typeof value === 'string') {
      const key = metadata?.data;
      if (key && isIdKey(key)) {
        const trimmed = value.trim();
        if (trimmed === '') return undefined;
        if (!validateUuid(trimmed)) throw new BadRequestException(`Invalid ${key}`);
        return trimmed;
      }
      return value;
    }

    if (metadata?.type === 'body') return normalizeIdsDeep(value);
    return value;
  }
}

