'use client';

import { Package } from 'lucide-react';

export default function OnlineOrdersPage() {
  return (
    <div className="h-full bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Package size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">ออเดอร์ออนไลน์</h1>
            <p className="text-sm text-gray-500">กำลังพัฒนาในเฟสถัดไป</p>
          </div>
        </div>

        <div className="mt-5 text-sm text-gray-600 space-y-1">
          <div>- หน้านี้ถูกปิดชั่วคราวเพื่อป้องกัน error</div>
          <div>- จะเปิดใช้งานเมื่อ API/Flow พร้อม</div>
        </div>
      </div>
    </div>
  );
}

