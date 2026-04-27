'use client';
import { useEffect, useState } from 'react';
import { carriersApi } from '@/lib/api';
import { CARRIERS, CARRIER_LIST, type CarrierConfig } from '@/constants/carriers';

// Backend sends snake_case with nested name object
export interface ApiCarrier {
  key: string;
  // Backend shape: { name: { th, zh, en }, tracking_url, has_cold, emoji }
  name?: { th?: string; zh?: string; en?: string };
  tracking_url?: string;
  has_cold?: boolean;
  emoji?: string;
  // Fallback camelCase shapes
  nameTh?: string;
  nameZh?: string;
  nameEn?: string;
  trackingUrl?: string;
  hasCold?: boolean;
}

export function useCarriers() {
  const [carriers, setCarriers] = useState<CarrierConfig[]>(CARRIER_LIST);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    carriersApi.list()
      .then(res => {
        const apiList = (res.data || []) as ApiCarrier[];
        if (apiList.length > 0) {
          // Merge API data with static config (static has rates/format, API has live config)
          const merged = apiList.map(a => {
            // Normalise: backend sends name.th or nameTh, tracking_url or trackingUrl, etc.
            const nameTh = a.name?.th ?? a.nameTh ?? '';
            const nameZh = a.name?.zh ?? a.nameZh ?? '';
            const nameEn = a.name?.en ?? a.nameEn ?? '';
            const trackingUrl = a.tracking_url ?? a.trackingUrl ?? '';
            const hasCold = a.has_cold ?? a.hasCold ?? false;

            const staticConfig = CARRIERS[a.key as keyof typeof CARRIERS];
            if (staticConfig) {
              return {
                ...staticConfig,
                name: {
                  th: nameTh || staticConfig.name.th,
                  zh: nameZh || staticConfig.name.zh,
                  en: nameEn || staticConfig.name.en,
                },
                emoji: a.emoji ?? staticConfig.emoji,
                tracking_url: trackingUrl || staticConfig.tracking_url,
                has_cold: hasCold ?? staticConfig.has_cold,
              };
            }
            // API-only carrier
            return {
              key: a.key,
              name: { th: nameTh, zh: nameZh, en: nameEn },
              emoji: a.emoji ?? '📦',
              tracking_url: trackingUrl,
              map_url: null,
              auto_append_tracking: false,
              tracking_format: null,
              tracking_placeholder: 'กรอกเลขพัสดุ',
              has_cold: hasCold,
              has_map: false,
              delivery_days: '-',
              rates: {},
            } as CarrierConfig;
          });
          setCarriers(merged);
        }
      })
      .catch(() => { /* fallback to static */ })
      .finally(() => setIsLoading(false));
  }, []);

  return { carriers, isLoading };
}
