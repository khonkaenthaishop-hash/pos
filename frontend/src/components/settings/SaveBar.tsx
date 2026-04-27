'use client';
import React from 'react';

interface Props {
  isDirty: boolean;
  isSubmitting: boolean;
  onReset: () => void;
}

export function SaveBar({ isDirty, isSubmitting, onReset }: Props) {
  if (!isDirty) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg px-6 py-3 flex items-center justify-between">
      <span className="text-sm text-slate-500">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 active:scale-95 transition"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 text-sm rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 active:scale-95 transition disabled:opacity-50"
        >
          {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </div>
  );
}
