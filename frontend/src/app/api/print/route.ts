import { NextRequest, NextResponse } from "next/server";
import { buildReceipt } from "@/lib/escpos/receiptBuilder";
import { sendToPrinter } from "@/lib/escpos/printerService";
import type { ReceiptData } from "@/lib/escpos/receiptBuilder";
import type { PrinterConfig } from "@/lib/escpos/printerService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { receipt, printer, payloadBase64 } = body as {
      receipt?: ReceiptData;
      printer: PrinterConfig;
      payloadBase64?: string;
    };

    if (!printer?.host) {
      return NextResponse.json(
        { success: false, error: "Missing required field: printer.host" },
        { status: 400 },
      );
    }

    if (typeof payloadBase64 === "string" && payloadBase64.length > 0) {
      const buffer = Buffer.from(payloadBase64, "base64");
      await sendToPrinter(buffer, printer);
      return NextResponse.json({ success: true });
    }

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "Missing required field: receipt (or payloadBase64)" },
        { status: 400 },
      );
    }

    // issuedAt comes in as ISO string from JSON — convert back to Date
    if (receipt.issuedAt) {
      receipt.issuedAt = new Date(receipt.issuedAt as unknown as string);
    }

    const buffer = buildReceipt(receipt);
    await sendToPrinter(buffer, printer);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
