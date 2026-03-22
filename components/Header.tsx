 'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/constants';

function HeaderInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);

  const categoryParam = searchParams.get('category') || 'all';
  const awardParam = searchParams.get('award') || 'all';
  const timeParam = searchParams.get('time') || 'all';

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      const params = new URLSearchParams(searchParams.toString());
      params.set('search', query);
      router.push(`/products?${params.toString()}`);
      setSearchQuery('');
      searchInputRef.current?.blur();
      mobileSearchInputRef.current?.blur();
      setMobileMenuOpen(false);
      setMobileSearchOpen(false);
    }
  }

  function openMobileSearch() {
    setMobileSearchOpen(true);
    setMobileMenuOpen(false);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
  }

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete(key);
    else params.set(key, value);
    router.push(`/products?${params.toString()}`);
    setMobileMenuOpen(false);
  }

  const dropdownClass = "h-9 px-2 text-xs font-sans font-semibold border border-charcoal bg-paper focus:outline-none focus:border-orange cursor-pointer hover:bg-paper-dark transition-colors appearance-none pr-6";
  const selectWrapper = "relative inline-block";
  const caretIcon = <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-charcoal-400 text-[10px]">▼</span>;

  return (
    <header className="sticky top-0 z-50 bg-paper border-b border-charcoal">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" id="header-logo" className="flex items-center gap-3 group shrink-0">
            <div className="flex flex-col leading-none">
              <span className="font-serif font-black text-xl text-ink tracking-tight group-hover:text-orange transition-colors duration-150">
                BIFL<span className="text-orange group-hover:text-ink">365</span>
              </span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-charcoal-200" />
            <span className="hidden sm:block text-2xs font-sans uppercase tracking-[0.15em] text-charcoal-400">
              Built to Last
            </span>
          </Link>

          {/* Right cluster: desktop search + filters + weekly CTA */}
          <nav className="flex items-center gap-3" aria-label="Main navigation">
            <div className="hidden lg:flex items-center gap-3">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="h-9 px-3 pr-8 text-xs font-sans border border-charcoal bg-paper focus:outline-none focus:border-orange w-40"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-charcoal-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>

              {/* Filters inline */}
              <div className="flex gap-2 border-l border-ghost pl-3">
                <div className={selectWrapper} title="Filter by Category">
                  <select value={categoryParam} onChange={(e) => updateFilter('category', e.target.value)} className={dropdownClass}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {caretIcon}
                </div>
                <div className={selectWrapper} title="Filter by Award">
                  <select value={awardParam} onChange={(e) => updateFilter('award', e.target.value)} className={dropdownClass}>
                    <option value="all">All Awards</option>
                    <option value="value_buy">Value Buy</option>
                    <option value="current_star">Current Star</option>
                    <option value="forever_pick">Forever Pick</option>
                    <option value="hidden_gem">Hidden Gem</option>
                  </select>
                  {caretIcon}
                </div>
                <div className={selectWrapper} title="Filter by Time">
                  <select value={timeParam} onChange={(e) => updateFilter('time', e.target.value)} className={dropdownClass}>
                    <option value="all">All Time</option>
                    <option value="this_week">This Week</option>
                    <option value="previous_weeks">Previous Weeks</option>
                  </select>
                  {caretIcon}
                </div>
              </div>
            </div>

            {/* Mobile search icon */}
            <button
              onClick={openMobileSearch}
              className="lg:hidden h-9 w-9 flex items-center justify-center border border-charcoal bg-paper hover:bg-paper-dark transition-colors"
              aria-label="Search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMobileSearchOpen(false); }}
              className="lg:hidden h-9 px-3 text-xs font-sans font-semibold border border-charcoal bg-paper hover:bg-paper-dark flex items-center gap-1"
            >
              Menu {mobileMenuOpen ? '▲' : '▼'}
            </button>

            {/* Weekly CTA */}
            <Link
              href="/weekly-pick"
              className="btn-primary text-xs h-9 px-4 flex items-center shrink-0"
              style={{ boxShadow: '2px 2px 0px 0px rgba(0,0,0,0.1)' }}
            >
              This Week ◆
            </Link>
          </nav>
        </div>
      </div>

      {/* Mobile expanding search bar */}
      {mobileSearchOpen && (
        <div className="lg:hidden bg-paper border-b border-charcoal px-4 py-3 shadow-inner">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="h-10 w-full px-3 pr-9 text-sm font-sans border border-charcoal bg-paper focus:outline-none focus:border-orange"
              />
              <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
              className="h-10 w-10 flex items-center justify-center border border-charcoal bg-paper hover:bg-paper-dark text-charcoal-400 transition-colors shrink-0"
              aria-label="Close search"
            >
              ✕
            </button>
          </form>
        </div>
      )}

      {/* Mobile expanding filter menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-paper-dark border-b border-charcoal px-4 py-4 space-y-3 shadow-inner">
          <div className="grid grid-cols-2 gap-2">
            <select value={categoryParam} onChange={(e) => updateFilter('category', e.target.value)} className={`${dropdownClass} w-full h-10`}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={awardParam} onChange={(e) => updateFilter('award', e.target.value)} className={`${dropdownClass} w-full h-10`}>
              <option value="all">Award: All</option>
              <option value="value_buy">Value Buy</option>
              <option value="current_star">Current Star</option>
              <option value="forever_pick">Forever Pick</option>
              <option value="hidden_gem">Hidden Gem</option>
            </select>
            <select value={timeParam} onChange={(e) => updateFilter('time', e.target.value)} className={`${dropdownClass} col-span-2 h-10`}>
              <option value="all">Time: All</option>
              <option value="this_week">This Week Only</option>
              <option value="previous_weeks">Previous Weeks</option>
            </select>
          </div>
        </div>
      )}
    </header>
  );
}

export function Header() {
  return (
    <Suspense fallback={<header className="h-14 bg-paper border-b border-charcoal" />}>
      <HeaderInner />
    </Suspense>
  );
}
