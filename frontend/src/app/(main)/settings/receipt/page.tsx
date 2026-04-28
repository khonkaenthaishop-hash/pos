"use client";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { SettingSection, FieldRow } from "@/components/settings/SettingSection";
import { SaveBar } from "@/components/settings/SaveBar";
import { useSettings } from "@/hooks/useSettings";

interface ReceiptSettings {
  headerText: string;
  footerLine1: string;
  footerLine2: string;
  footerLine3: string;
  showLogo: boolean;
  showQrCode: boolean;
  showPhone: boolean;
  showAddress: boolean;
  fontSize: "sm" | "md" | "lg";
  receiptWidth: 55 | 58 | 72 | 80;
}

const DEFAULTS: ReceiptSettings = {
  headerText: "KHONKAEN THAISHOP",
  footerLine1: "Thank you",
  footerLine2: "",
  footerLine3: "",
  showLogo: true,
  showQrCode: true,
  showPhone: true,
  showAddress: false,
  fontSize: "md",
  receiptWidth: 72,
};

function ReceiptPreview({ data }: { data: ReceiptSettings }) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-4 font-mono shadow-inner"
      style={{
        fontSize:
          data.fontSize === "sm" ? 10 : data.fontSize === "lg" ? 14 : 12,
      }}
    >
      <div className="text-center font-bold mb-1">
        {data.headerText || "Shop Name"}
      </div>
      {data.showPhone && (
        <div className="text-center text-slate-500">Tel: 09x-xxx-xxxx</div>
      )}
      {data.showAddress && (
        <div className="text-center text-slate-500">123 Example Rd.</div>
      )}
      <div className="border-t border-dashed border-slate-300 my-2" />
      <div className="flex justify-between">
        <span>Product A x2</span>
        <span>120.00</span>
      </div>
      <div className="flex justify-between">
        <span>Product B x1</span>
        <span>60.00</span>
      </div>
      <div className="border-t border-dashed border-slate-300 my-2" />
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>180.00</span>
      </div>
      {data.showQrCode && (
        <div className="text-center mt-2 text-xs text-slate-400">[QR CODE]</div>
      )}
      <div className="border-t border-dashed border-slate-300 my-2" />
      {[data.footerLine1, data.footerLine2, data.footerLine3]
        .filter(Boolean)
        .map((l, i) => (
          <div key={i} className="text-center text-slate-500">
            {l}
          </div>
        ))}
    </div>
  );
}

export default function ReceiptSettingsPage() {
  const { data, isLoading, save } = useSettings<ReceiptSettings>("receipt");
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isDirty, isSubmitting },
  } = useForm<ReceiptSettings>({
    defaultValues: DEFAULTS,
  });
  const watched = useWatch({ control });

  useEffect(() => {
    if (data) {
      const normalized = {
        ...DEFAULTS,
        ...data,
        receiptWidth:
          data.receiptWidth === 58
            ? 55
            : data.receiptWidth === 80
              ? 72
              : data.receiptWidth,
      };
      reset(normalized);
    }
  }, [data, reset]);

  const onSubmit = async (values: ReceiptSettings) => {
    const ok = await save(values as unknown as Record<string, unknown>);
    if (ok) reset(values);
  };

  if (isLoading)
    return <div className="text-sm text-slate-400 p-4">Loading...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SettingsPageShell
        title="Receipt"
        description="Receipt text and print format settings"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <SettingSection title="Text">
              <FieldRow label="Header">
                <input
                  {...register("headerText")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </FieldRow>
              <FieldRow label="Footer line 1">
                <input
                  {...register("footerLine1")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </FieldRow>
              <FieldRow label="Footer line 2">
                <input
                  {...register("footerLine2")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </FieldRow>
              <FieldRow label="Footer line 3">
                <input
                  {...register("footerLine3")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </FieldRow>
            </SettingSection>

            <SettingSection title="Display">
              {[
                { name: "showLogo" as const,    label: "Show logo" },
                { name: "showQrCode" as const,  label: "Show QR code" },
                { name: "showPhone" as const,   label: "Show phone" },
                { name: "showAddress" as const, label: "Show address" },
              ].map(({ name, label }) => (
                <label key={name} className="flex items-center gap-3 cursor-pointer py-1">
                  <input type="checkbox" {...register(name)} className="accent-orange-500 w-4 h-4" />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </SettingSection>

            <SettingSection title="Format">
              <FieldRow label="Font size">
                <select
                  {...register("fontSize")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </FieldRow>
              <FieldRow label="Paper width">
                <select
                  {...register("receiptWidth", { valueAsNumber: true })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value={55}>55 mm</option>
                  <option value={72}>72 mm</option>
                </select>
              </FieldRow>
            </SettingSection>
          </div>

          {/* Live Preview */}
          <div className="sticky top-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Preview
            </div>
            <div style={{ maxWidth: watched.receiptWidth === 58 ? 200 : 280 }}>
              <ReceiptPreview data={watched as ReceiptSettings} />
            </div>
          </div>
        </div>
      </SettingsPageShell>
      <SaveBar
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        onReset={() => reset({ ...DEFAULTS, ...data })}
      />
    </form>
  );
}
