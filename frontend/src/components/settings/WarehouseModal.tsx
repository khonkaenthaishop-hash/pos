'use client';
import React, { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { settingsApi } from '@/lib/api';

interface Warehouse {
  id?: string;
  name: string;
  zone?: string;
  address?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  warehouse: Warehouse | null;
  onSaved: () => void;
}

export function WarehouseModal({ open, onClose, warehouse, onSaved }: Props) {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Warehouse>();

  useEffect(() => {
    if (warehouse) {
      reset(warehouse);
    } else {
      reset({ name: '', zone: '', address: '', isDefault: false, isActive: true });
    }
  }, [warehouse, reset]);

  const onSubmit = async (data: Warehouse) => {
    try {
      if (warehouse?.id) {
        await settingsApi.updateWarehouse(warehouse.id, data as any);
      } else {
        await settingsApi.createWarehouse(data as any);
      }
      toast.success(warehouse?.id ? 'อัปเดตคลังสินค้าแล้ว' : 'เพิ่มคลังสินค้าแล้ว');
      onSaved();
      onClose();
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-slate-800">
              {warehouse?.id ? 'แก้ไขคลังสินค้า' : 'เพิ่มคลังสินค้า'}
            </Dialog.Title>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">ชื่อคลัง *</label>
              <input
                {...register('name', { required: true })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="คลังหลัก"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">โซน</label>
              <input
                {...register('zone')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="A, B, C ..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">ที่อยู่</label>
              <textarea
                {...register('address')}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" {...register('isDefault')} className="accent-orange-500 w-4 h-4" />
                ตั้งเป็นค่าเริ่มต้น
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" {...register('isActive')} className="accent-orange-500 w-4 h-4" />
                ใช้งานอยู่
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
