'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  Store, Receipt, Printer, Users, ShieldCheck,
  Package, Warehouse, Tag, Truck, Bell,
  Bot, Lock, BarChart2, Settings,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'ร้านค้า',
    items: [
      { href: '/settings/general',       label: 'ข้อมูลร้านค้า',   icon: Store },
      { href: '/settings/receipt',        label: 'ใบเสร็จ',         icon: Receipt },
      { href: '/settings/printer',        label: 'เครื่องพิมพ์',    icon: Printer },
    ],
  },
  {
    label: 'ทีมงาน',
    items: [
      { href: '/settings/users',          label: 'ผู้ใช้งาน',       icon: Users },
      { href: '/settings/roles',          label: 'สิทธิ์การใช้งาน', icon: ShieldCheck, ownerOnly: true },
    ],
  },
  {
    label: 'คลังสินค้า',
    items: [
      { href: '/settings/inventory',      label: 'สินค้าคงคลัง',    icon: Package },
      { href: '/settings/warehouse',      label: 'คลังสินค้า',      icon: Warehouse },
      { href: '/settings/pricing',        label: 'ราคาและภาษี',     icon: Tag },
    ],
  },
  {
    label: 'การขนส่ง',
    items: [
      { href: '/settings/shipping',       label: 'การขนส่ง',        icon: Truck },
    ],
  },
  {
    label: 'การแจ้งเตือน',
    items: [
      { href: '/settings/notifications',  label: 'การแจ้งเตือน',    icon: Bell },
    ],
  },
  {
    label: 'ขั้นสูง',
    ownerOnly: true,
    items: [
      { href: '/settings/ai',             label: 'AI & โมเดล',      icon: Bot,      ownerOnly: true },
      { href: '/settings/security',       label: 'ความปลอดภัย',     icon: Lock,     ownerOnly: true },
      { href: '/settings/analytics',      label: 'Analytics',       icon: BarChart2 },
      { href: '/settings/system',         label: 'ระบบ',            icon: Settings, ownerOnly: true },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as Record<string, string> | null)?.role ?? '';
  const isOwner = role === 'owner';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings sidebar */}
      <aside className="w-52 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">ตั้งค่าระบบ</h2>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-4">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(i => !i.ownerOnly || isOwner);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                          active
                            ? 'bg-orange-50 text-orange-600'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        )}
                      >
                        <Icon size={15} />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {children}
      </main>
    </div>
  );
}
