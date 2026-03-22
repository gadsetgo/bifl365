'use client';

import { useState } from 'react';

interface PipelineConfig {
  run_day?: string;
  run_time?: string;
  products_per_category?: number;
  auto_approve_mode?: boolean;
  research_provider?: string;
  scoring_provider?: string;
  content_provider?: string;
}

interface ScheduleEditorProps {
  initialConfig: PipelineConfig;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PROVIDERS = ['gemini', 'claude', 'ollama'];
const PROVIDERS_WITH_NONE = ['gemini', 'claude', 'ollama', 'none'];

function getNextRunDate(day: string, time: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = days.indexOf(day);
  if (targetDay === -1 || !time) return '';

  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  let daysUntil = (targetDay - now.getDay() + 7) % 7;
  if (daysUntil === 0 && next <= now) daysUntil = 7;
  next.setDate(now.getDate() + daysUntil);

  // Use a fixed locale to avoid SSR/client mismatch
  return next.toLocaleString('en-GB', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function ScheduleEditor({ initialConfig }: ScheduleEditorProps) {
  const [config, setConfig] = useState<PipelineConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isVercel = typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_VERCEL === '1');

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.errors?.[0]?.message ?? `HTTP ${res.status}`);
      }
      setMessage({ type: 'success', text: 'Schedule saved.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const nextRun = config.run_day && config.run_time
    ? getNextRunDate(config.run_day, config.run_time)
    : null;

  return (
    <div className="bg-white border border-charcoal shadow-card">
      <div className="px-5 py-4 border-b border-ghost flex items-center justify-between">
        <h2 className="font-serif font-bold text-xl text-ink">Auto-Pipeline Schedule & Config</h2>
        {nextRun && (
          <span className="text-xs font-sans text-charcoal-400">
            Next run: <strong className="text-ink">{nextRun}</strong>
          </span>
        )}
      </div>

      {/* Vercel read-only warning */}
      {process.env.NEXT_PUBLIC_VERCEL === '1' && (
        <div className="mx-5 mt-4 p-3 bg-orange-pale border border-orange text-sm font-sans text-charcoal">
          <strong className="text-orange uppercase tracking-widest text-xs">Vercel Warning:</strong>{' '}
          The filesystem is read-only on Vercel. Config changes must be committed to git to persist across deployments.
        </div>
      )}

      <div className="p-5 space-y-5">
        {/* Schedule */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
              Run Day
            </label>
            <select
              value={config.run_day ?? 'Sunday'}
              onChange={(e) => setConfig((c) => ({ ...c, run_day: e.target.value }))}
              className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange bg-white"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
              Run Time (24h)
            </label>
            <input
              type="time"
              value={config.run_time ?? '22:30'}
              onChange={(e) => setConfig((c) => ({ ...c, run_time: e.target.value }))}
              className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange"
            />
          </div>

          <div>
            <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
              Products per Category
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.products_per_category ?? 3}
              onChange={(e) => setConfig((c) => ({ ...c, products_per_category: Number(e.target.value) }))}
              className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange"
            />
          </div>
        </div>

        {/* Providers for scheduled runs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
              Research Provider
            </label>
            <select
              value={config.research_provider ?? 'gemini'}
              onChange={(e) => setConfig((c) => ({ ...c, research_provider: e.target.value }))}
              className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange bg-white"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
              Scoring Provider
            </label>
            <select
              value={config.scoring_provider ?? 'gemini'}
              onChange={(e) => setConfig((c) => ({ ...c, scoring_provider: e.target.value }))}
              className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange bg-white"
            >
              {PROVIDERS_WITH_NONE.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-1">
              Content Provider
            </label>
            <select
              value={config.content_provider ?? 'gemini'}
              onChange={(e) => setConfig((c) => ({ ...c, content_provider: e.target.value }))}
              className="w-full border border-charcoal px-3 py-2 text-sm font-sans focus:outline-none focus:border-orange bg-white"
            >
              {PROVIDERS_WITH_NONE.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto-approve */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.auto_approve_mode ?? false}
            onChange={(e) => setConfig((c) => ({ ...c, auto_approve_mode: e.target.checked }))}
            className="w-4 h-4 border border-charcoal accent-orange"
          />
          <span className="text-sm font-sans text-ink">
            Auto-approve mode — skip review queue and publish directly
          </span>
        </label>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-6 bg-orange border border-charcoal text-paper font-sans uppercase text-xs tracking-widest font-bold hover:bg-orange/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Config'}
          </button>
          {message && (
            <span className={`text-sm font-sans ${message.type === 'success' ? 'text-orange' : 'text-error'}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
