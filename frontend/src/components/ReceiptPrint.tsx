"use client";

import { useMemo } from "react";
import Image from "next/image";

export function ReceiptPrint({
  text,
  widthMm = 72,
  qrImageUrl,
}: {
  text: string;
  widthMm?: number;
  qrImageUrl?: string;
}) {
  const pageStyle = useMemo(
    () => `
@media print {
  @page { size: ${widthMm}mm auto; margin: 0; }
  html, body { width: ${widthMm}mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`,
    [widthMm],
  );

  return (
    <div className="bg-white text-black">
      <style>{pageStyle}</style>
      <div
        className="mx-auto px-2 py-2"
        style={{
          width: `${widthMm}mm`,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: "12px",
          lineHeight: 1.35,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>

      {qrImageUrl ? (
        <div className="mx-auto pb-4" style={{ width: `${widthMm}mm` }}>
          <div className="flex justify-center">
            <div style={{ width: "40mm", height: "40mm", position: "relative" }}>
              <Image
                src={qrImageUrl}
                alt="QR"
                fill
                sizes="160px"
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
