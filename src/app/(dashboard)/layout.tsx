'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, FileText, Users,
  DollarSign, AlertTriangle, Menu, X, ChevronDown, Settings, LogOut
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/inventory',   label: 'Inventory',  icon: Package,
    children: [
      { href: '/inventory',       label: 'All Items' },
      { href: '/inventory/new',   label: 'Add Item' },
      { href: '/inventory/kits',  label: 'Kits' },
      { href: '/inventory/kits/new', label: 'Create Kit' },
    ]
  },
  { href: '/quotes',      label: 'Quotes',     icon: FileText,
    children: [
      { href: '/quotes',     label: 'All Quotes' },
      { href: '/quotes/new', label: 'New Quote' },
    ]
  },
  { href: '/customers',   label: 'Customers',  icon: Users,
    children: [
      { href: '/customers',     label: 'All Customers' },
      { href: '/customers/new', label: 'New Customer' },
    ]
  },
  { href: '/finance',     label: 'Finance',    icon: DollarSign },
  { href: '/damage',      label: 'Damage/Loss', icon: AlertTriangle },
  { href: '/settings',    label: 'Settings',   icon: Settings },
];

function NavItem({ item, pathname }: { item: typeof navItems[0]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <item.icon size={18} />
          {item.label}
          <ChevronDown size={14} className={cn('ml-auto transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="ml-9 mt-1 flex flex-col gap-0.5">
            {item.children.map(child => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'px-3 py-2 text-sm rounded-lg transition-colors',
                  pathname === child.href
                    ? 'text-indigo-700 font-medium bg-indigo-50'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      <item.icon size={18} />
      {item.label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col',
        'transform transition-transform duration-200 ease-in-out',
        'lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Package size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base leading-tight">
              RigSync<br />
              <span className="text-xs font-normal text-gray-500">AV Project Management</span>
            </span>
          </div>
          <button
            className="lg:hidden p-1 rounded text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(item => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-4 border-t border-gray-100">
          {userEmail && (
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-700 font-semibold text-xs uppercase">
                  {userEmail[0]}
                </span>
              </div>
              <p className="text-xs text-gray-600 truncate flex-1">{userEmail}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-4">
          <button
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-medium text-gray-500 hidden lg:block">
            {navItems.find(i => pathname === i.href || pathname.startsWith(i.href + '/'))?.label ?? 'Dashboard'}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
