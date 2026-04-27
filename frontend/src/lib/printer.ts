// lib/printer-settings.ts
export interface PrinterSettings {
  ip: string;
  port: number;
  paperWidth: "58" | "72" | "80";
  shopName: string;
  phone: string;
  footer1: string;
  footer2: string;
  autoPrint: boolean;
}

export const defaultSettings: PrinterSettings = {
  ip: "192.168.1.121",
  port: 9100,
  paperWidth: "72",
  shopName: "My shop",
  phone: "",
  footer1: "Thank you",
  footer2: "",
  autoPrint: true,
};

export function loadSettings(): PrinterSettings {
  if (typeof window === "undefined") return defaultSettings;
  const saved = localStorage.getItem("printer_settings");
  return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
}

export function saveSettings(s: PrinterSettings) {
  localStorage.setItem("printer_settings", JSON.stringify(s));
}
