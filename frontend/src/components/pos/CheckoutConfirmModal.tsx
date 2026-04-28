'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, Banknote, QrCode, CreditCard, Receipt, CheckCircle, Loader2 } from 'lucide-react';
import SlipUpload from '@/components/pos/SlipUpload';
import CustomerDropdown, { Customer } from '@/components/pos/CustomerDropdown';
import { useLanguage } from '@/i18n/LanguageProvider';

type PaymentMethodType = 'cash' | 'qr' | 'transfer' | 'cod';

type Props = {
  open: boolean;
  onClose: () => void;

  customer: Customer | null;
  onCustomerChange: (c: Customer | null) => void;
  note: string;
  onNoteChange: (v: string) => void;

  subtotal: number;
  discount: number;
  includeVat: boolean;
  onIncludeVatChange: (v: boolean) => void;
  vatAmount: number;
  netTotal: number;

  paymentMethod: PaymentMethodType;
  onPaymentMethodChange: (pm: PaymentMethodType) => void;

  cashReceived: string;
  onCashReceivedChange: (v: string) => void;
  change: number;

  slipUrl: string;
  onSlipUrlChange: (v: string) => void;

  isDebt: boolean;
  onIsDebtChange: (v: boolean) => void;
  dueDate: string;
  onDueDateChange: (v: string) => void;
  dueDateMin: string;

  onConfirmPay: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
};

function money(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

export default function CheckoutConfirmModal({
  open,
  onClose,
  customer,
  onCustomerChange,
  note,
  onNoteChange,
  subtotal,
  discount,
  includeVat,
  onIncludeVatChange,
  vatAmount,
  netTotal,
  paymentMethod,
  onPaymentMethodChange,
  cashReceived,
  onCashReceivedChange,
  change,
  slipUrl,
  onSlipUrlChange,
  isDebt,
  onIsDebtChange,
  dueDate,
  onDueDateChange,
  dueDateMin,
  onConfirmPay,
  isSubmitting,
  disabled,
}: Props) {
  const { t } = useLanguage();
  const paymentLabelMap: Record<PaymentMethodType, string> = {
    cash: t('payment.cash'),
    qr: 'QR',
    transfer: t('payment.transfer'),
    cod: t('payment.cod'),
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {t('checkout.confirm_title')}
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="border border-gray-200 rounded-2xl p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t('checkout.customer')}
              </div>
              <CustomerDropdown value={customer} onChange={onCustomerChange} />
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder={t('checkout.note')}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 resize-none"
              />
            </div>

            <div className="border border-gray-200 rounded-2xl p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t('checkout.customer')}</span>
                <span className="font-semibold text-gray-900">
                  {customer?.name || t('checkout.walk_in')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t('checkout.subtotal')}</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t('checkout.bill_discount')}</span>
                <span className="tabular-nums">{money(discount)}</span>
              </div>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={includeVat}
                    onChange={(e) => onIncludeVatChange(e.target.checked)}
                    className="rounded"
                  />
                  {t('checkout.vat_label')}
                </span>
                <span className="tabular-nums text-gray-500">
                  {includeVat ? money(vatAmount) : '—'}
                </span>
              </label>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between font-bold">
                <span>{t('checkout.net_total')}</span>
                <span className="text-orange-600 text-base tabular-nums">{money(netTotal)}</span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-2xl p-3 space-y-3">
              <div className="text-sm font-semibold text-gray-900">{t('checkout.payment_type')}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['cash', 'qr', 'transfer', 'cod'] as PaymentMethodType[]).map((pm) => (
                  <button
                    key={pm}
                    onClick={() => onPaymentMethodChange(pm)}
                    className={`py-2 rounded-xl border text-xs font-semibold transition flex flex-col items-center gap-0.5 ${
                      paymentMethod === pm
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    {pm === 'cash' && <Banknote size={14} />}
                    {pm === 'qr' && <QrCode size={14} />}
                    {pm === 'transfer' && <CreditCard size={14} />}
                    {pm === 'cod' && <Receipt size={14} />}
                    {paymentLabelMap[pm]}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div className="border border-gray-200 rounded-2xl p-3 space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {[50, 100, 500, 1000].map((v) => (
                      <button
                        key={v}
                        onClick={() => onCashReceivedChange(String(v))}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs hover:bg-orange-50 hover:border-orange-300 font-medium"
                      >
                        {v}
                      </button>
                    ))}
                    <button
                      onClick={() => onCashReceivedChange(money(netTotal))}
                      className="px-2.5 py-1.5 border border-orange-200 rounded-xl text-xs bg-orange-50 text-orange-600 font-medium"
                    >
                      {t('checkout.exact')}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t('checkout.cash_received')}</span>
                    <input
                      value={cashReceived}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || Number(v) >= 0) onCashReceivedChange(v);
                      }}
                      type="number"
                      min={0}
                      placeholder="0.00"
                      className="w-32 text-right border border-gray-200 rounded-xl px-2 py-1.5 text-sm outline-none focus:border-orange-400 tabular-nums"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t('checkout.change')}</span>
                    <span className={`font-bold tabular-nums ${change > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {money(change)}
                    </span>
                  </div>
                </div>
              )}

              {(paymentMethod === 'qr' || paymentMethod === 'transfer') && (
                <SlipUpload value={slipUrl} onChange={onSlipUrlChange} required />
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDebt_modal"
                  checked={isDebt}
                  onChange={(e) => onIsDebtChange(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="isDebt_modal" className="text-sm text-gray-600 cursor-pointer">
                  {t('checkout.debt')}
                </label>
              </div>
              {isDebt && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-semibold text-amber-700">
                    {t('checkout.due_required')}
                  </div>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => onDueDateChange(e.target.value)}
                    min={dueDateMin}
                    className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
            <button
              onClick={onConfirmPay}
              disabled={disabled || isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-950 disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm transition"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {t('checkout.pay')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
