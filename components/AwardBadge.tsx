'use client';

import type { AwardType } from '@/lib/types';

interface AwardBadgeProps {
  type: AwardType;
  size?: 'sm' | 'md' | 'lg' | 'header';
}

const AWARD_CONFIG: Record<AwardType, { label: string; symbol: string; bg: string; border: string; text: string }> = {
  value_buy: {
    label: 'Value Buy',
    symbol: '◆',
    bg: 'bg-orange',
    border: 'border-charcoal',
    text: 'text-paper',
  },
  forever_pick: {
    label: 'Forever Pick',
    symbol: '∞',
    bg: 'bg-charcoal-600',
    border: 'border-charcoal-400',
    text: 'text-paper',
  },
  hidden_gem: {
    label: 'Hidden Gem',
    symbol: '◈',
    bg: 'bg-paper',
    border: 'border-charcoal',
    text: 'text-ink',
  },
  current_star: {
    label: 'Current Star',
    symbol: '★',
    bg: 'bg-orange-pale text-orange',
    border: 'border-orange',
    text: 'text-orange',
  },
};

export function AwardBadge({ type, size = 'md' }: AwardBadgeProps) {
  const cfg = AWARD_CONFIG[type];
  if (!cfg) return null;

  const sizeClasses = {
    sm: 'text-2xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
    header: 'text-2xs px-2.5 h-9 gap-1',
  };

  return (
    <span
      className={`
        inline-flex items-center ${sizeClasses[size]}
        ${cfg.bg} ${cfg.text} ${cfg.border}
        border font-sans font-bold uppercase tracking-widest
        transition-transform duration-150 hover:scale-105
      `}
      style={{ boxShadow: '1px 1px 0px 0px #121212' }}
    >
      <span className="opacity-70">{cfg.symbol}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

// Large stamp version for the homepage showcase
export function AwardStamp({ type }: { type: AwardType }) {
  const cfg = AWARD_CONFIG[type];
  if (!cfg) return null;
  const descriptions: Record<AwardType, string> = {
    value_buy: 'Best price-to-durability ratio for Indian buyers',
    forever_pick: 'Absolute best build quality, regardless of price',
    hidden_gem: 'Under-the-radar BIFL pick most people haven\'t tried',
    current_star: 'A good buy in recently trending products',
  };

  return (
    <div
      className={`
        flex flex-col gap-3 p-6 border ${cfg.border}
        ${cfg.bg} ${cfg.text}
        transition-all duration-200 cursor-pointer
        hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#121212]
      `}
      style={{ boxShadow: '3px 3px 0px 0px #121212' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl font-serif">{cfg.symbol}</span>
        <span className="font-sans font-bold text-sm uppercase tracking-widest">{cfg.label}</span>
      </div>
      <p className="text-xs font-sans opacity-70 leading-relaxed">{descriptions[type]}</p>
    </div>
  );
}
