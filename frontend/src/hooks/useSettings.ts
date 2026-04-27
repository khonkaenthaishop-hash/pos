'use client';
import { useState, useEffect, useCallback } from 'react';
import { settingsApi } from '@/lib/api';
import toast from 'react-hot-toast';

export function useSettings<T>(group: string) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await settingsApi.get(group);
      setData(res.data);
    } catch {
      toast.error('โหลดการตั้งค่าไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, [group]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (values: Partial<T>) => {
    try {
      const res = await settingsApi.update(group, values as Record<string, unknown> & Partial<T>);
      setData(res.data);
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว');
      return true;
    } catch {
      toast.error('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      return false;
    }
  }, [group]);

  return { data, isLoading, save, reload: load };
}
