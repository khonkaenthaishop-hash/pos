import { Injectable, Logger } from '@nestjs/common';
import { EmailType } from './shipping-email.entity';

export interface ParsedShippingEmail {
  emailType: EmailType;
  cmOrderNumber: string | null;
  cNumber: string | null;
  orderDate: string | null;        // YYYY-MM-DD
  phoneLast3: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  shippingFee: number | null;
  paymentMethod: string | null;
  deliveryMethod: string | null;
}

// Map Chinese subject keywords → email_type
const SUBJECT_TYPE_MAP: Array<{ keyword: string; type: EmailType }> = [
  { keyword: '訂單成立通知', type: 'created' },
  { keyword: '賣家完成寄貨訂單通知', type: 'shipped' },
  { keyword: '賣家完成取貨訂單通知', type: 'completed' },
  { keyword: '已送達', type: 'arrived' },
  { keyword: '買家訂單取消通知', type: 'cancelled' },
  { keyword: '賣家未於3天內取貨', type: 'warning' },
  { keyword: '未於期限內取貨', type: 'returned' },
];

@Injectable()
export class ShippingEmailParserService {
  private readonly logger = new Logger(ShippingEmailParserService.name);

  parseEmailType(subject: string): EmailType {
    for (const { keyword, type } of SUBJECT_TYPE_MAP) {
      if (subject.includes(keyword)) {
        return type;
      }
    }
    // Default — treat as created if no match
    this.logger.warn(`Unknown email subject: "${subject}", defaulting to "created"`);
    return 'created';
  }

  parseEmailBody(body: string): Omit<ParsedShippingEmail, 'emailType'> {
    return {
      cmOrderNumber: this.extractCmOrderNumber(body),
      cNumber: this.extractCNumber(body),
      orderDate: this.extractOrderDate(body),
      phoneLast3: this.extractPhoneLast3(body),
      totalAmount: this.extractAmount(body, '訂單總額'),
      subtotal: this.extractAmount(body, '商品總額'),
      shippingFee: this.extractAmount(body, '運費'),
      paymentMethod: this.extractTextField(body, '付款方式'),
      deliveryMethod: this.extractTextField(body, '配送方式'),
    };
  }

  parse(subject: string, body: string): ParsedShippingEmail {
    const emailType = this.parseEmailType(subject);
    const fields = this.parseEmailBody(body);
    return { emailType, ...fields };
  }

  // ─── Private parsing helpers ──────────────────────────────────────

  private extractCmOrderNumber(body: string): string | null {
    // e.g. CM2606170063142 or CM2606170063142-1
    const match = body.match(/CM\d{13,16}(-\d)?/);
    return match ? match[0] : null;
  }

  private extractCNumber(body: string): string | null {
    // e.g. C72529686308 (交貨便服務代碼)
    const match = body.match(/C\d{10,12}/);
    return match ? match[0] : null;
  }

  private extractOrderDate(body: string): string | null {
    // Look for 訂單日期 field followed by a date value
    // Common formats: 2026/06/17 or 2026-06-17
    const patterns = [
      /訂單日期[^\d]*(\d{4})[/-](\d{2})[/-](\d{2})/,
      /訂購日期[^\d]*(\d{4})[/-](\d{2})[/-](\d{2})/,
    ];
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
    return null;
  }

  private extractPhoneLast3(body: string): string | null {
    // Masked phone format: 0983***074 → last 3 chars
    // Look near 收者資訊 / 收件人
    const phonePattern = /0\d{3}\*{3}(\d{3})/;
    const match = body.match(phonePattern);
    return match ? match[1] : null;
  }

  private extractAmount(body: string, label: string): number | null {
    // e.g. 訂單總額：NT$550 or 訂單總額 550
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}[^\\d]*NT\\$?([\\d,]+(?:\\.\\d{1,2})?)`);
    const match = body.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const val = parseFloat(raw);
      return isNaN(val) ? null : val;
    }
    return null;
  }

  private extractTextField(body: string, label: string): string | null {
    // e.g. 付款方式：取貨付款
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}[：:：\\s]*([^\n<>]{1,50})`);
    const match = body.match(pattern);
    if (match) {
      return match[1].trim().replace(/&nbsp;/g, '').replace(/\s+/g, ' ').trim();
    }
    return null;
  }
}
