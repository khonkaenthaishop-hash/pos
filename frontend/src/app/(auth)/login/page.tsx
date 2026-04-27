'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await signIn('credentials', {
        username: form.username,
        password: form.password,
        redirect: false,
      });
      if (res?.error) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      } else {
        router.push('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-orange-500 p-12 text-white">
        <div>
          <div className="text-3xl font-bold">🏪</div>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight">ร้านขอนแก่น</h1>
          <p className="mt-2 text-orange-100 text-lg">Thai Grocery Store — Taiwan</p>
        </div>
        <div className="space-y-4 text-orange-100 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <span>ระบบ POS สำหรับร้านค้าไทยในไต้หวัน</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <span>รองรับ 3 ภาษา: ไทย | 繁體中文 | English</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <span>จัดการสต็อก ออเดอร์ และจัดส่งครบวงจร</span>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center bg-gray-950 p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">เข้าสู่ระบบ</h2>
            <p className="mt-1 text-sm text-gray-400">กรุณาใส่ข้อมูลเพื่อเข้าใช้งาน</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="ชื่อผู้ใช้"
                required
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-4 py-3 text-sm outline-none focus:border-orange-500 placeholder-gray-500 transition"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="รหัสผ่าน"
                required
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-4 py-3 text-sm outline-none focus:border-orange-500 placeholder-gray-500 transition"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-lg py-3 text-sm transition"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>เข้าสู่ระบบ <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
