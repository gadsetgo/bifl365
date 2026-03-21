'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminSidebar() {
  const pathname = usePathname();

  const links = [
    { label: 'Dashboard', href: '/admin', icon: '◱' },
    { label: 'Review Queue', href: '/admin/review', icon: '✓' },
    { label: 'Images', href: '/admin/images', icon: '🖼' },
    { label: 'Products', href: '/admin/products', icon: '☰' },
    { label: 'Suggestions', href: '/admin/suggestions', icon: '💡' },
    { label: 'Pipeline', href: '/admin/pipeline', icon: '⚙' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-charcoal text-paper shrink-0 fixed top-0 left-0 h-screen border-r border-charcoal-600 z-50">
        <div className="h-14 flex items-center px-4 border-b border-charcoal-600 shrink-0">
           <span className="font-serif font-black text-xl tracking-tight">
              BIFL<span className="text-orange">365</span>
            </span>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {links.map((li) => {
            const isActive = pathname === li.href;
            return (
              <Link
                key={li.href}
                href={li.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-sans transition-colors ${
                  isActive ? 'bg-charcoal-700 text-orange font-semibold border-l-2 border-orange' : 'text-charcoal-200 hover:text-paper hover:bg-charcoal-600'
                }`}
              >
                <span className="w-5 text-center text-lg">{li.icon}</span>
                {li.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-charcoal-700 border-t border-charcoal-600 z-50 flex items-center justify-around px-1 pb-safe">
        {links.map((li) => {
          const isActive = pathname === li.href;
          return (
            <Link
              key={li.href}
              href={li.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive ? 'text-orange' : 'text-charcoal-200'
              }`}
            >
              <span className="text-xl leading-none">{li.icon}</span>
              <span className="text-[8px] font-sans uppercase tracking-widest">{li.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
