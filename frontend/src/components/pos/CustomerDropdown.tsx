'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, User, X, Plus } from 'lucide-react';
import { customersApi } from '@/lib/api';

export type Customer = {
  id: string;
  code?: string;
  name?: string;
  phone?: string;
  type?: string;
  totalDebt?: number;
  loyaltyPoints?: number;
  address711?: string;
  addressFamilyMart?: string;
  addressYamato?: string;
  expireDate?: string;
};

interface Props {
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  onCreateNew?: () => void;
}

const MAX_DEBT = 2000;

export default function CustomerDropdown({ value, onChange, onCreateNew }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setIsLoading(true);
      customersApi.list(query || undefined, 1, 20)
        .then(r => {
          const data = r.data as any;
          const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
          setResults(items as Customer[]);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const select = (c: Customer) => {
    onChange(c);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange(null);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-orange-50">
          <User size={14} className="text-orange-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{value.name || value.phone || 'ลูกค้า'}</div>
            <div className="text-xs text-gray-500 flex gap-2">
              {value.code && <span>{value.code}</span>}
              {value.phone && <span>{value.phone}</span>}
              {(value.totalDebt || 0) > 0 && (
                <span className="text-red-500 font-semibold">หนี้ {Number(value.totalDebt).toLocaleString()} ฿</span>
              )}
            </div>
          </div>
          <button type="button" onClick={clear} className="text-gray-300 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 cursor-pointer hover:border-orange-300"
          onClick={() => setOpen(true)}
        >
          <User size={14} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-400 flex-1">ลูกค้าเงินสด / เลือกลูกค้า</span>
          <Search size={13} className="text-gray-300" />
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5">
              <Search size={13} className="text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ชื่อ / โทร / รหัส..."
                className="flex-1 text-sm outline-none"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 text-xs text-gray-400 text-center">กำลังโหลด...</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-xs text-gray-400 text-center">ไม่พบลูกค้า</div>
            ) : (
              results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 flex items-center gap-2"
                >
                  <User size={13} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name || '—'}</div>
                    <div className="text-xs text-gray-400 flex gap-2">
                      {c.phone && <span>{c.phone}</span>}
                      {(c.totalDebt || 0) > 0 && (
                        <span className={`font-semibold ${Number(c.totalDebt) >= MAX_DEBT ? 'text-red-600' : 'text-amber-600'}`}>
                          หนี้ {Number(c.totalDebt).toLocaleString()} ฿
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {onCreateNew && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => { setOpen(false); onCreateNew(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
              >
                <Plus size={14} /> เพิ่มลูกค้าใหม่
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
