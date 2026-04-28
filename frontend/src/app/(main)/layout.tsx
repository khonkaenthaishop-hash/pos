'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingCart, Package, Tag,
  Warehouse, BarChart2, Shield, LogOut, Truck, Users, Layers,
  PackagePlus, ClipboardList, Trash2, Settings, Menu, X, ChevronLeft, History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANG_LABEL } from '@/i18n/translations';
import { useLanguage } from '@/i18n/LanguageProvider';

const NAV: Array<{
  href: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: string[];
}> = [
  { href: '/dashboard',           labelKey: 'nav.dashboard',     icon: LayoutDashboard },
  { href: '/pos',                 labelKey: 'nav.pos',           icon: ShoppingCart },
  { href: '/sales-history',       labelKey: 'nav.salesHistory',  icon: History },
  { href: '/online-orders',       labelKey: 'nav.onlineOrders',  icon: Package },
  { href: '/products',            labelKey: 'nav.products',      icon: Tag },
  { href: '/categories',          labelKey: 'nav.categories',    icon: Layers,        roles: ['owner', 'manager'] },
  { href: '/stock',               labelKey: 'nav.stock',         icon: Warehouse },
  { href: '/inventory/receive',   labelKey: 'nav.receive',       icon: PackagePlus,   roles: ['owner', 'manager', 'staff'] },
  { href: '/inventory/adjust',    labelKey: 'nav.adjust',        icon: ClipboardList, roles: ['owner', 'manager', 'staff'] },
  { href: '/inventory/discard',   labelKey: 'nav.discard',       icon: Trash2,        roles: ['owner', 'manager'] },
  { href: '/shipments',           labelKey: 'nav.shipments',     icon: Truck,         roles: ['owner', 'manager', 'admin'] },
  { href: '/customers',           labelKey: 'nav.customers',     icon: Users,         roles: ['owner', 'manager', 'admin'] },
  { href: '/users',               labelKey: 'nav.users',         icon: Users,         roles: ['owner', 'manager'] },
  { href: '/audit',               labelKey: 'nav.audit',         icon: Shield },
  { href: '/reports',             labelKey: 'nav.reports',       icon: BarChart2 },
  { href: '/settings',            labelKey: 'nav.settings',      icon: Settings,      roles: ['owner', 'manager'] },
];

// Bottom nav — mobile only
const BOTTOM_NAV = [
  { href: '/dashboard', labelKey: 'bottom.home',     icon: LayoutDashboard },
  { href: '/pos',       labelKey: 'bottom.pos',      icon: ShoppingCart },
  { href: '/products',  labelKey: 'bottom.products', icon: Tag },
  { href: '/stock',     labelKey: 'bottom.stock',    icon: Warehouse },
  { href: '/settings',  labelKey: 'bottom.settings', icon: Settings },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { lang, toggleLang, t } = useLanguage();

  // mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);
  // desktop collapsed (icon-only)
  const [collapsed, setCollapsed] = useState(false);

  const accessToken = (session as Record<string, unknown> | null)?.accessToken as string | undefined;
  const user = session?.user;
  const role = (user as Record<string, string> | null | undefined)?.role || '';
  const initials = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase();

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      if (typeof window !== 'undefined') localStorage.removeItem('access_token');
      router.replace('/login');
      return;
    }
    if (status === 'authenticated') {
      if (!accessToken) { signOut({ callbackUrl: '/login' }); return; }
      if (typeof window !== 'undefined') localStorage.setItem('access_token', accessToken);
    }
  }, [status, accessToken, router]);

  const filteredNav = NAV.filter(i => !i.roles || (role && i.roles.includes(role)));

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 bg-slate-900 flex flex-col shrink-0 transition-all duration-200',
        // mobile: drawer behaviour
        'lg:static',
        mobileOpen ? 'translate-x-0 w-56' : '-translate-x-full w-56',
        // desktop: collapsed ↔ expanded
        'lg:translate-x-0',
        collapsed ? 'lg:w-14' : 'lg:w-56',
      )}>
        {/* Logo / collapse button */}
        <div className="px-3 py-4 border-b border-slate-800 flex items-center justify-between min-h-15">
          {!collapsed && (
            <div className="flex-1 min-w-0 pl-1">
              <div className="text-orange-400 font-extrabold text-base leading-none truncate">ร้านขอนแก่น</div>
              <div className="text-slate-400 text-xs mt-0.5">POS System</div>
            </div>
          )}
          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
            title={collapsed ? 'ขยาย sidebar' : 'ย่อ sidebar'}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {filteredNav.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            const label = t(labelKey);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                  active
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-slate-800 p-2">
          <div className={cn('flex items-center gap-2.5 px-1 py-2', collapsed && 'justify-center')}>
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">
                  {(user as Record<string, string> | null | undefined)?.nameTh || user?.name || user?.email}
                </div>
                <div className="text-slate-500 text-xs capitalize">
                  {(user as Record<string, string> | null | undefined)?.role || 'user'}
                </div>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLang}
                  className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
                  title={t('common.language')}
                >
                  {LANG_LABEL[lang]}
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                  title={t('common.logout')}
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu size={22} />
          </button>
          <div className="text-orange-500 font-extrabold text-base">ร้านขอนแก่น POS</div>
          <button
            onClick={toggleLang}
            className="ml-auto px-2.5 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold"
            title={t('common.language')}
          >
            {LANG_LABEL[lang]}
          </button>
        </header>

        <main className="flex-1 overflow-hidden pb-16 lg:pb-0">{children}</main>

        {/* Bottom nav — mobile only */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 flex">
          {BOTTOM_NAV.filter(i => {
            if (i.href === '/settings' && role && !['owner', 'manager'].includes(role)) return false;
            return true;
          }).map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-orange-500' : 'text-gray-400 hover:text-gray-700',
                )}
              >
                <Icon size={20} />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
