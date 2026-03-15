'use client';

import { useState, useRef, useEffect } from 'react';
import type { CategoryType, AwardType } from '@/lib/types';
import { CATEGORIES } from '@/lib/constants';

type WeekFilter = 'all' | 'this_week' | 'previous_weeks';

interface FilterBarProps {
  activeCategory: CategoryType | 'all';
  onCategoryChange: (cat: CategoryType | 'all') => void;
  awardFilter: AwardType | 'all';
  onAwardChange: (award: AwardType | 'all') => void;
  weekFilter: WeekFilter;
  onWeekChange: (week: WeekFilter) => void;
}

export function CompactFilterBar({
  activeCategory,
  onCategoryChange,
  awardFilter,
  onAwardChange,
  weekFilter,
  onWeekChange,
}: FilterBarProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pinnedCategories = CATEGORIES.slice(0, 5);
  const overflowCategories = CATEGORIES.slice(5);
  const overflowActive = overflowCategories.some((c) => c.value === activeCategory);

  return (
    <div className="flex items-center gap-2 flex-wrap text-2xs font-sans uppercase tracking-widest">
      {/* Category filter */}
      <div className="flex items-center gap-2">
        <span className="text-charcoal-400 whitespace-nowrap">Category:</span>
        <div className="flex items-center gap-1 flex-wrap">
          {pinnedCategories.map(({ value, label }) => {
            const isActive = value === activeCategory;
            return (
              <button
                key={value}
                onClick={() => onCategoryChange(value)}
                className={`px-2.5 py-1 border transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-charcoal text-paper border-charcoal'
                    : 'bg-paper text-ink border-charcoal hover:bg-paper-dark'
                }`}
              >
                {label}
              </button>
            );
          })}
          {overflowCategories.length > 0 && (
            <div className="relative" ref={categoryRef}>
              <button
                onClick={() => setCategoryOpen((v) => !v)}
                className={`px-2.5 py-1 border transition-colors flex items-center gap-1 ${
                  overflowActive
                    ? 'bg-charcoal text-paper border-charcoal'
                    : 'bg-paper text-ink border-charcoal hover:bg-paper-dark'
                }`}
              >
                {overflowActive
                  ? overflowCategories.find((c) => c.value === activeCategory)?.label ?? 'More'
                  : 'More'}
                <span className={`transition-transform duration-150 ${categoryOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {categoryOpen && (
                <div
                  className="absolute top-full left-0 mt-1 z-50 border border-charcoal bg-paper min-w-[140px]"
                  style={{ boxShadow: '3px 3px 0px 0px #121212' }}
                >
                  {overflowCategories.map(({ value, label }) => {
                    const isActive = value === activeCategory;
                    return (
                      <button
                        key={value}
                        onClick={() => {
                          onCategoryChange(value);
                          setCategoryOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 border-b border-ghost last:border-0 transition-colors ${
                          isActive ? 'bg-charcoal text-paper' : 'text-ink hover:bg-paper-dark'
                        }`}
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
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-charcoal-200" />

      {/* Award filter */}
      <div className="flex items-center gap-2">
        <span className="text-charcoal-400 whitespace-nowrap">Award:</span>
        <div className="flex items-center gap-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'best_buy', label: 'Best Buy' },
            { value: 'forever_pick', label: 'Forever' },
            { value: 'hidden_gem', label: 'Hidden' },
          ].map(({ value, label }) => {
            const isActive = awardFilter === value;
            return (
              <button
                key={value}
                onClick={() => onAwardChange(value as AwardType | 'all')}
                className={`px-2.5 py-1 border transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-charcoal text-paper border-charcoal'
                    : 'bg-paper text-ink border-charcoal hover:bg-paper-dark'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-charcoal-200" />

      {/* Week filter */}
      <div className="flex items-center gap-2">
        <span className="text-charcoal-400 whitespace-nowrap">Time:</span>
        <div className="flex items-center gap-1">
          {[
            { value: 'all', label: 'All Time' },
            { value: 'this_week', label: 'This Week' },
            { value: 'previous_weeks', label: 'Previous' },
          ].map(({ value, label }) => {
            const isActive = weekFilter === value;
            return (
              <button
                key={value}
                onClick={() => onWeekChange(value as WeekFilter)}
                className={`px-2.5 py-1 border transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-charcoal text-paper border-charcoal'
                    : 'bg-paper text-ink border-charcoal hover:bg-paper-dark'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
