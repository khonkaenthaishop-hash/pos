'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, SwitchCamera } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';

type Props = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camIndex, setCamIndex] = useState(0);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Enumerate cameras once
  useEffect(() => {
    let cancelled = false;
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      BrowserMultiFormatReader.listVideoInputDevices()
        .then(devices => {
          if (cancelled) return;
          if (devices.length === 0) {
            setStatus('error');
            setErrorMsg('ไม่พบกล้องในอุปกรณ์นี้');
            return;
          }
          const backIdx = devices.findIndex(d => /back|rear|environment/i.test(d.label));
          setCameras(devices);
          setCamIndex(backIdx >= 0 ? backIdx : 0);
        })
        .catch(() => {
          if (!cancelled) {
            setStatus('error');
            setErrorMsg('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง');
          }
        });
    });
    return () => { cancelled = true; };
  }, []);

  // Start scanning when camIndex changes
  useEffect(() => {
    if (cameras.length === 0 || !videoRef.current) return;

    let cancelled = false;

    // Stop previous
    controlsRef.current?.stop();
    controlsRef.current = null;
    setStatus('loading');

    const deviceId = cameras[camIndex]?.deviceId;

    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      if (cancelled || !videoRef.current) return;
      const reader = new BrowserMultiFormatReader();

      reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err, controls) => {
        if (cancelled) { controls.stop(); return; }
        // Store controls so we can stop later
        controlsRef.current = controls;
        setStatus('scanning');

        if (result) {
          cancelled = true;
          controls.stop();
          onDetected(result.getText());
        }
        void err; // suppress "no barcode" errors
      }).catch(() => {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg('ไม่สามารถเปิดกล้องได้');
        }
      });
    });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameras, camIndex, onDetected]);

  return (
    <div className="fixed inset-0 z-60 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
        <span className="text-white font-semibold text-sm">แสกนบาร์โค้ด</span>
        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <button
              onClick={() => setCamIndex(i => (i + 1) % cameras.length)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white"
              title="สลับกล้อง"
            >
              <SwitchCamera size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Video */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        {/* Viewfinder */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-40">
              <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-orange-400 rounded-tl" />
              <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-orange-400 rounded-tr" />
              <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-orange-400 rounded-bl" />
              <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-orange-400 rounded-br" />
              <div className="absolute inset-x-0 h-0.5 bg-orange-400/70 animate-scan-line" />
            </div>
          </div>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
            <Loader2 size={32} className="animate-spin text-orange-400" />
            <span className="text-white text-sm">กำลังเปิดกล้อง...</span>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4 p-6">
            <span className="text-white text-center text-sm">{errorMsg}</span>
            <button onClick={onClose} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold">
              ปิด
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {status === 'scanning' && (
        <div className="shrink-0 bg-black/80 px-4 py-3 text-center">
          <p className="text-white/70 text-xs">จ่อบาร์โค้ดให้อยู่ในกรอบสีส้ม</p>
        </div>
      )}
    </div>
  );
}
