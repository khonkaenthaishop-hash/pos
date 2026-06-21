'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Mail, RefreshCw, Unlink, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { gmailShippingApi } from '@/lib/api';
import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { SettingSection } from '@/components/settings/SettingSection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GmailStatus {
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** แปลง ISO date → DD/MM/YY HH:mm (Buddhist Era) */
function formatBuddhistDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear() + 543).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

// ─── Inner component (needs Suspense for useSearchParams) ─────────────────────

function GmailSettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // ── Show callback toast (after OAuth redirect back) ──
  useEffect(() => {
    const callback = searchParams.get('callback');
    if (callback === 'true') {
      toast.success('เชื่อมต่อ Gmail สำเร็จ');
      // Clean up query param without full reload
      const params = new URLSearchParams(searchParams.toString());
      params.delete('callback');
      const qs = params.toString();
      router.replace(`/settings/gmail${qs ? '?' + qs : ''}`);
    }
  }, [searchParams, router]);

  // ── Load status ──
  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await gmailShippingApi.status();
      setStatus(res.data as GmailStatus);
    } catch {
      toast.error('ไม่สามารถโหลดสถานะ Gmail ได้');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ── Connect Gmail ──
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await gmailShippingApi.authUrl();
      const { url } = res.data as { url: string };
      if (url) {
        window.location.href = url;
      } else {
        toast.error('ไม่ได้รับ URL สำหรับเชื่อมต่อ');
      }
    } catch {
      toast.error('ไม่สามารถเชื่อมต่อ Gmail ได้');
    } finally {
      setIsConnecting(false);
    }
  };

  // ── Sync now ──
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await gmailShippingApi.sync();
      const { processed, matched, errors } = res.data as {
        processed: number;
        matched: number;
        errors: number;
      };
      toast.success(
        `Sync สำเร็จ: ${processed} emails, ${matched} matched${errors > 0 ? `, ${errors} errors` : ''}`,
      );
      await loadStatus();
    } catch {
      toast.error('Sync ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Disconnect ──
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await gmailShippingApi.disconnect();
      toast.success('ยกเลิกการเชื่อมต่อ Gmail แล้ว');
      setShowDisconnectConfirm(false);
      await loadStatus();
    } catch {
      toast.error('ยกเลิกการเชื่อมต่อไม่สำเร็จ');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <SettingsPageShell
        title="การเชื่อมต่อ Gmail"
        description="เชื่อมต่อ Gmail เพื่อดึงข้อมูลการจัดส่งอัตโนมัติ"
      >
        <SettingSection>
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            กำลังโหลด...
          </div>
        </SettingSection>
      </SettingsPageShell>
    );
  }

  const connected = status?.connected ?? false;

  return (
    <SettingsPageShell
      title="การเชื่อมต่อ Gmail"
      description="เชื่อมต่อ Gmail เพื่อดึงข้อมูลการจัดส่งจาก 7-11 อัตโนมัติ"
    >
      <SettingSection title="สถานะ Gmail">
        {connected ? (
          /* ─── Connected state ─── */
          <div className="space-y-5">
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-sm font-semibold text-green-700">เชื่อมต่อแล้ว</span>
              </div>
              <span className="text-sm text-slate-500">({status?.email ?? ''})</span>
            </div>

            {/* Sync times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <div className="text-xs text-slate-400 mb-1">Sync ล่าสุด</div>
                <div className="text-sm font-medium text-slate-700">
                  {formatBuddhistDateTime(status?.lastSyncAt ?? null)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <div className="text-xs text-slate-400 mb-1">Sync ถัดไป (โดยประมาณ)</div>
                <div className="text-sm font-medium text-slate-700">
                  {formatBuddhistDateTime(status?.nextSyncAt ?? null)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition"
              >
                {isSyncing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
                Sync ตอนนี้
              </button>

              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition"
              >
                <Unlink size={15} />
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          </div>
        ) : (
          /* ─── Disconnected state ─── */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <WifiOff size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500 font-medium">ยังไม่ได้เชื่อมต่อ</span>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed">
              เชื่อมต่อ Gmail เพื่อดึงข้อมูลการจัดส่งจาก 7-11 อัตโนมัติ เช่น C Number,
              สถานะพัสดุ, และยอดเงิน
            </p>

            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition"
            >
              {isConnecting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Mail size={15} />
              )}
              เชื่อมต่อ Gmail
            </button>
          </div>
        )}
      </SettingSection>

      {/* How it works section */}
      <SettingSection title="วิธีการทำงาน">
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <Wifi size={14} className="text-orange-400 mt-0.5 shrink-0" />
            <span>ระบบจะ sync email จาก 7-11 ทุก 15 นาทีอัตโนมัติ</span>
          </div>
          <div className="flex items-start gap-2">
            <RefreshCw size={14} className="text-orange-400 mt-0.5 shrink-0" />
            <span>กด "Sync ตอนนี้" เพื่อดึงข้อมูลทันที</span>
          </div>
          <div className="flex items-start gap-2">
            <Mail size={14} className="text-orange-400 mt-0.5 shrink-0" />
            <span>ดู C Number และยืนยันรายการที่หน้า ติดตามการจัดส่ง</span>
          </div>
        </div>
      </SettingSection>

      {/* Disconnect confirmation dialog */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200">
            <div className="px-5 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Unlink size={18} className="text-red-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">ยกเลิกการเชื่อมต่อ Gmail?</div>
                  <div className="text-xs text-gray-400 mt-0.5">{status?.email}</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                ระบบจะหยุดดึงข้อมูลจาก Gmail และ token จะถูกลบออก
                คุณสามารถเชื่อมต่อใหม่ได้ตลอดเวลา
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition"
              >
                {isDisconnecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Unlink size={14} />
                )}
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsPageShell>
  );
}

// ─── Page export (wrap in Suspense for useSearchParams) ───────────────────────

export default function GmailSettingsPage() {
  return (
    <Suspense
      fallback={
        <SettingsPageShell
          title="การเชื่อมต่อ Gmail"
          description="เชื่อมต่อ Gmail เพื่อดึงข้อมูลการจัดส่งอัตโนมัติ"
        >
          <SettingSection>
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              กำลังโหลด...
            </div>
          </SettingSection>
        </SettingsPageShell>
      }
    >
      <GmailSettingsContent />
    </Suspense>
  );
}
