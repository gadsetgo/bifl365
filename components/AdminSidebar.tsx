'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// --- SVG Icons ---
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V5zM3 13a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z" />
  </svg>
);

const ProductsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const PipelineIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BarChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// --- Types ---
type NavLink = {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
};

type SidebarProps = {
  pendingReviewCount?: number;
};

export function AdminSidebar({ pendingReviewCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { label: 'Dashboard', href: '/admin', icon: <DashboardIcon />, exact: true },
    { label: 'Products', href: '/admin/board', icon: <ProductsIcon />, badge: pendingReviewCount || undefined },
    { label: 'Pipeline', href: '/admin/pipeline', icon: <PipelineIcon /> },
    { label: 'Analytics', href: '/admin/analytics', icon: <BarChartIcon /> },
  ];

  const isActive = (li: NavLink) =>
    li.exact ? pathname === li.href : pathname.startsWith(li.href);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-charcoal text-paper shrink-0 fixed top-0 left-0 h-screen border-r border-charcoal-600 z-50">
        <div className="h-14 flex items-center px-5 border-b border-charcoal-600 shrink-0">
          <span className="font-serif font-black text-xl tracking-tight">
            BIFL<span className="text-orange">365</span>
          </span>
          <span className="ml-2 text-[9px] font-sans uppercase tracking-widest text-charcoal-400">Admin</span>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {links.map((li) => {
            const active = isActive(li);
            return (
              <Link
                key={li.href}
                href={li.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-sans transition-colors relative ${
                  active
                    ? 'bg-charcoal-700 text-orange font-semibold border-l-2 border-orange pl-[10px]'
                    : 'text-charcoal-200 hover:text-paper hover:bg-charcoal-600'
                }`}
              >
                <span className="shrink-0">{li.icon}</span>
                <span className="flex-1">{li.label}</span>
                {li.badge !== undefined && (
                  <span className="min-w-[20px] h-5 px-1 text-[10px] font-bold bg-orange text-paper rounded-full flex items-center justify-center">
                    {li.badge > 99 ? '99+' : li.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-charcoal-600">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-xs font-sans text-charcoal-400 hover:text-paper transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Site
          </a>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-charcoal-700 border-t border-charcoal-600 z-50 flex items-center justify-around px-1 pb-safe">
        {links.map((li) => {
          const active = isActive(li);
          return (
            <Link
              key={li.href}
              href={li.href}
              className={`relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors ${
                active ? 'text-orange' : 'text-charcoal-200'
              }`}
            >
              {li.badge !== undefined && (
                <span className="absolute top-1 right-1/4 min-w-[14px] h-3.5 px-0.5 text-[8px] font-bold bg-orange text-paper rounded-full flex items-center justify-center leading-none">
                  {li.badge > 9 ? '9+' : li.badge}
                </span>
              )}
              <span className="text-[18px] leading-none">{li.icon}</span>
              <span className="text-[7px] font-sans uppercase tracking-widest">{li.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
