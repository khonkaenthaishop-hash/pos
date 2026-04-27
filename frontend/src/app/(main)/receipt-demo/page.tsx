"use client";

import { useMemo } from "react";
import { STORE_INFO } from "@/constants/store";
import { buildReceiptText } from "@/lib/receipt";
import { ReceiptPrint } from "@/components/ReceiptPrint";

export default function ReceiptDemoPage() {
  const receiptText = useMemo(() => {
    return buildReceiptText(
      {
        receiptNo: "INV20240619001",
        issuedAt: new Date("2024-06-19T10:13:00"),
        cashierName: "Admin",
        items: [
          { name: "ลาเต้ร้อน", qty: 1, price: 65.0 },
          { name: "เค้กช็อกโกแลต", qty: 1, price: 120.0 },
        ],
        discount: 0,
        vatRate: 0.07,
        payment: { methodLabel: "เงินสด", received: 200.0, change: 2.05 },
      },
      {
        charsPerLine: 48,
        store: {
          headerLines: [
            STORE_INFO.name,
            STORE_INFO.tagline,
            STORE_INFO.address,
            STORE_INFO.phone,
          ],
          footerLines: [...STORE_INFO.footerLines],
        },
      },
    );
  }, []);

  return (
    <div className="h-full bg-gray-50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Receipt Demo</h1>
          <p className="text-xs text-gray-500">
            กระดาษ 72mm, ตัวอย่าง 48 chars/line
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm"
        >
          พิมพ์
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <ReceiptPrint
          text={receiptText}
          widthMm={72}
          qrImageUrl={STORE_INFO.qrImageUrl}
        />
      </div>

      <div className="text-xs text-gray-500">
        หมายเหตุ: ต้องมีไฟล์ QR ที่{" "}
        <code className="font-mono">frontend/public/facebook-qr.png</code>
      </div>
    </div>
  );
}
