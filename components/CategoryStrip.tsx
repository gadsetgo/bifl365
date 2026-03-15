'use client';

import { useState, useRef, useEffect } from 'react';
import type { CategoryType } from '@/lib/types';
import { CATEGORIES } from '@/lib/constants';

interface CategoryStripProps {
  activeCategory?: CategoryType | 'all';
  onSelect?: (cat: CategoryType | 'all') => void;
  useNavigation?: boolean;
}

const PINNED_COUNT = 5; // Number of categories always visible as pills

export function CategoryStrip({ activeCategory = 'all', onSelect, useNavigation = false }: CategoryStripProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleClick(cat: CategoryType | 'all') {
    setOpen(false);
    if (onSelect) {
      onSelect(cat);
    } else if (useNavigation) {
      const url = cat === 'all' ? '/products' : `/category/${cat}`;
      window.location.href = url;
    }
  }

  const pinned = CATEGORIES.slice(0, PINNED_COUNT);
  const overflow = CATEGORIES.slice(PINNED_COUNT);
  const overflowActive = overflow.some((c) => c.value === activeCategory);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Pinned pills */}
      {pinned.map(({ value, label }) => {
        const isActive = value === activeCategory;
        return (
          <button
            key={value}
            id={`category-${value}`}
            onClick={() => handleClick(value)}
            className={`
              px-4 py-2 font-sans font-semibold text-xs uppercase tracking-wider whitespace-nowrap
              border transition-all duration-150
              ${isActive
                ? 'bg-charcoal text-paper border-charcoal'
                : 'bg-paper text-ink border-charcoal hover:bg-charcoal hover:text-paper'
              }
            `}
            style={isActive ? { boxShadow: '2px 2px 0px 0px #FF5733' } : {}}
          >
            {label}
          </button>
        );
      })}

      {/* Overflow dropdown — only rendered if there are more categories */}
      {overflow.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`
              px-4 py-2 font-sans font-semibold text-xs uppercase tracking-wider whitespace-nowrap
              border transition-all duration-150 flex items-center gap-1
              ${overflowActive
                ? 'bg-charcoal text-paper border-charcoal'
                : 'bg-paper text-ink border-charcoal hover:bg-charcoal hover:text-paper'
              }
            `}
            style={overflowActive ? { boxShadow: '2px 2px 0px 0px #FF5733' } : {}}
          >
            {overflowActive
              ? (overflow.find((c) => c.value === activeCategory)?.label ?? 'More')
              : 'More'}
            <span className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {open && (
            <div
              className="absolute top-full left-0 mt-1 z-50 border border-charcoal bg-paper min-w-[160px]"
              style={{ boxShadow: '3px 3px 0px 0px #121212' }}
            >
              {overflow.map(({ value, label }) => {
                const isActive = value === activeCategory;
                return (
                  <button
                    key={value}
                    onClick={() => handleClick(value)}
                    className={`
                      w-full text-left px-4 py-2.5 font-sans font-semibold text-xs uppercase tracking-wider
                      border-b border-ghost last:border-0 transition-colors
                      ${isActive ? 'bg-charcoal text-paper' : 'text-ink hover:bg-paper-dark'}
                    `}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
