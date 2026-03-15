'use client';

import type { ProductScores } from '@/lib/types';

interface ScoreBarProps {
  scores: ProductScores;
  totalScore?: number;
  compact?: boolean;
}

const SCORE_LABELS: Record<keyof ProductScores, { label: string; abbr: string }> = {
  build_quality: { label: 'Build Quality', abbr: 'BUILD' },
  longevity: { label: 'Longevity', abbr: 'LIFESPAN' },
  value: { label: 'Value for India', abbr: 'VALUE' },
  repairability: { label: 'Repairability', abbr: 'REPAIR' },
  india_availability: { label: 'India Availability', abbr: 'AVAIL.' },
};

export function ScoreBar({ scores, totalScore, compact = false }: ScoreBarProps) {
  const total = totalScore ?? Object.values(scores).reduce((a, b) => a + b, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-ghost border border-ghost overflow-hidden">
          <div
            className="h-full bg-orange transition-all duration-700"
            style={{ width: `${total}%` }}
          />
        </div>
        <span className="text-xs font-bold font-sans text-ink tabular-nums">{total}/100</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {(Object.keys(SCORE_LABELS) as Array<keyof ProductScores>).map((key) => {
        const score = scores[key];
        const pct = (score / 20) * 100;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="section-label w-20 shrink-0 text-right">
              {SCORE_LABELS[key].abbr}
            </span>
            <div className="flex-1 h-1.5 bg-ghost border-b border-ghost overflow-hidden">
              <div
                className="h-full bg-charcoal transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-bold font-sans text-ink tabular-nums w-8 text-right">
              {score}/20
            </span>
          </div>
        );
      })}
      {/* Total */}
      <div className="pt-2 mt-1 border-t border-charcoal flex items-center justify-between">
        <span className="section-label">BIFL SCORE</span>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-ghost border border-charcoal overflow-hidden">
            <div
              className="h-full bg-orange transition-all duration-700"
              style={{ width: `${total}%` }}
            />
          </div>
          <span className="text-base font-bold font-serif text-ink">{total}/100</span>
        </div>
      </div>
    </div>
  );
}
