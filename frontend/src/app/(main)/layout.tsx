'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingCart, Package, Tag,
  Warehouse, BarChart2, Shield, LogOut, Truck, Users, Layers,
  PackagePlus, ClipboardList, Trash2, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
}> = [
  { href: '/dashboard',     label: 'แดชบอร์ด',     icon: LayoutDashboard },
  { href: '/pos',           label: 'POS ขายหน้าร้าน', icon: ShoppingCart },
  { href: '/online-orders', label: 'ออเดอร์ออนไลน์', icon: Package },
  { href: '/products',      label: 'จัดการสินค้า',   icon: Tag },
  { href: '/categories',    label: 'หมวดหมู่',       icon: Layers, roles: ['owner', 'manager'] },
  { href: '/stock',              label: 'คลังสินค้า',       icon: Warehouse },
  { href: '/inventory/receive',  label: 'รับสินค้าเข้า',    icon: PackagePlus,  roles: ['owner', 'manager', 'staff'] },
  { href: '/inventory/adjust',   label: 'นับสต็อก/ปรับยอด', icon: ClipboardList, roles: ['owner', 'manager', 'staff'] },
  { href: '/inventory/discard',  label: 'เคลียร์สินค้า',    icon: Trash2,        roles: ['owner', 'manager'] },
  { href: '/shipments',     label: 'จัดส่ง',         icon: Truck, roles: ['owner', 'manager', 'admin'] },
  { href: '/customers',     label: 'ลูกค้า',         icon: Users, roles: ['owner', 'manager', 'admin'] },
  { href: '/users',         label: 'ผู้ใช้งาน',      icon: Users, roles: ['owner', 'manager'] },
  { href: '/audit',         label: 'Audit Log',      icon: Shield },
  { href: '/reports',       label: 'รายงาน',         icon: BarChart2 },
  { href: '/settings',      label: 'ตั้งค่า',         icon: Settings, roles: ['owner', 'manager'] },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const accessToken = (session as Record<string, unknown> | null)?.accessToken as string | undefined;
  const user = session?.user;
  const role = (user as Record<string, string> | null | undefined)?.role || '';
  const initials = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      if (typeof window !== 'undefined') localStorage.removeItem('access_token');
      router.replace('/login');
      return;
    }

    if (status === 'authenticated') {
      if (!accessToken) {
        signOut({ callbackUrl: '/login' });
        return;
      }
      if (typeof window !== 'undefined') localStorage.setItem('access_token', accessToken);
    }
  }, [status, accessToken, router]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="text-orange-400 font-extrabold text-lg leading-none">ร้านขอนแก่น</div>
          <div className="text-slate-400 text-xs mt-0.5">POS System</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.filter(i => !i.roles || (role && i.roles.includes(role))).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">
                {(user as Record<string, string> | null | undefined)?.nameTh || user?.name || user?.email}
              </div>
              <div className="text-slate-500 text-xs capitalize">
                {(user as Record<string, string> | null | undefined)?.role || 'user'}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-slate-500 hover:text-red-400 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
