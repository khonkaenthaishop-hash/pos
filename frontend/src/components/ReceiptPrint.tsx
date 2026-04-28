"use client";

import { useMemo } from "react";

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
    // NOTE: Avoid Tailwind classes here because html2canvas cannot parse some modern color functions (e.g. oklch).
    // Inline styles keep PNG export working.
    <div style={{ backgroundColor: "#ffffff", color: "#000000" }}>
      <style>{pageStyle}</style>
      <div
        style={{
          marginLeft: "auto",
          marginRight: "auto",
          padding: "8px",
          width: `${widthMm}mm`,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: "12px",
          lineHeight: 1.35,
          whiteSpace: "pre",
        }}
      >
        {text}
      </div>

      {qrImageUrl ? (
        <div
          style={{
            marginLeft: "auto",
            marginRight: "auto",
            paddingBottom: "16px",
            width: `${widthMm}mm`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "40mm", height: "40mm", position: "relative" }}>
              {/* Use plain <img> so html2canvas can export PNG without CORS-taint issues */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="QR"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
