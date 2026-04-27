import { NextRequest, NextResponse } from "next/server";
import { buildReceipt } from "@/lib/escpos/receiptBuilder";
import { sendToPrinter } from "@/lib/escpos/printerService";
import type { ReceiptData } from "@/lib/escpos/receiptBuilder";
import type { PrinterConfig } from "@/lib/escpos/printerService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { receipt, printer } = body as {
      receipt: ReceiptData;
      printer: PrinterConfig;
    };

    if (!receipt || !printer?.host) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: receipt, printer.host" },
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
