 'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AwardBadge } from './AwardBadge';
import { CATEGORIES } from '@/lib/constants';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      if (pathname === '/products') {
        // If already on products page, update URL with search param
        router.push(`/products?search=${encodeURIComponent(query)}`);
      } else {
        // Navigate to products page with search
        router.push(`/products?search=${encodeURIComponent(query)}`);
      }
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-paper border-b border-charcoal">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" id="header-logo" className="flex items-center gap-3 group">
            <div className="flex flex-col leading-none">
              <span className="font-serif font-black text-xl text-ink tracking-tight group-hover:text-orange transition-colors duration-150">
                BIFL<span className="text-orange group-hover:text-ink">365</span>
              </span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-charcoal-200" />
            <span className="hidden sm:block text-2xs font-sans uppercase tracking-[0.15em] text-charcoal-400">
              Buy It For Life
            </span>
          </Link>

          {/* Right cluster: search + dropdown + mini awards + weekly CTA */}
          <nav className="flex items-center gap-2" aria-label="Main navigation">
            {/* Search bar */}
            <form onSubmit={handleSearch} className="hidden lg:block">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="h-9 px-3 pr-8 text-xs font-sans border border-charcoal bg-paper focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange w-48"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-ink transition-colors"
                  aria-label="Search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Browse dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="h-9 px-3 text-xs font-sans font-semibold uppercase tracking-wider border border-charcoal bg-paper hover:bg-paper-dark transition-colors flex items-center gap-1"
              >
                Browse
                <span className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {open && (
                <div
                  className="absolute right-0 mt-1 w-52 border border-charcoal bg-paper z-50"
                  style={{ boxShadow: '3px 3px 0px 0px #121212' }}
                >
                  {/* All products + weekly pick */}
                  <Link
                    href="/products"
                    className="block w-full px-3 py-2 text-2xs font-sans uppercase tracking-widest border-b border-ghost hover:bg-paper-dark"
                    onClick={() => setOpen(false)}
                  >
                    All Products
                  </Link>
                  <Link
                    href="/weekly-pick"
                    className="block w-full px-3 py-2 text-2xs font-sans uppercase tracking-widest border-b border-ghost hover:bg-paper-dark"
                    onClick={() => setOpen(false)}
                  >
                    Weekly Pick
                  </Link>

                  {/* Dynamic categories */}
                  {CATEGORIES.filter((c) => c.value !== 'all').map(({ value, label }) => (
                    <Link
                      key={value}
                      href={`/products?category=${value}`}
                      className="block w-full px-3 py-2 text-2xs font-sans uppercase tracking-widest border-b border-ghost last:border-0 hover:bg-paper-dark"
                      onClick={() => setOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Compact Three Tiers of Excellence */}
            <div className="hidden md:flex items-center gap-1">
              <AwardBadge type="best_buy" size="header" />
              <AwardBadge type="forever_pick" size="header" />
              <AwardBadge type="hidden_gem" size="header" />
            </div>

            {/* Weekly CTA */}
            <Link
              href="/weekly-pick"
              id="nav-weekly-cta"
              className="btn-primary text-xs h-9 px-3 flex items-center"
            >
              This Week ◆
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
