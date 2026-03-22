'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  value: string;
  label: string;
}

interface PipelineTriggerFormProps {
  disabled?: boolean;
  categories: Category[];
}

export function PipelineTriggerForm({ disabled = false, categories }: PipelineTriggerFormProps) {
  const router = useRouter();
  const [provider, setProvider] = useState<'gemini' | 'claude'>('gemini');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (val: string) => {
    setSelectedCategories((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]
    );
  };

  const handleTrigger = async () => {
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/pipeline/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="bg-white border border-charcoal shadow-card p-5 space-y-5">
      <h2 className="font-serif font-bold text-xl text-ink">Trigger Online Pipeline</h2>

      {/* Provider selection */}
      <div>
        <p className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-2">AI Provider</p>
        <div className="grid grid-cols-2 gap-3">
          {(['gemini', 'claude'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`p-3 border text-sm font-sans font-bold text-left transition-colors ${
                provider === p
                  ? 'border-orange bg-orange-pale text-orange'
                  : 'border-charcoal text-ink hover:bg-paper-dark'
              }`}
            >
              {p === 'gemini' ? 'Gemini' : 'Claude'}
              <span className="block text-[10px] font-normal uppercase tracking-widest mt-0.5 text-charcoal-400">
                {p === 'gemini' ? 'Google Gemini Flash' : 'Anthropic Claude Haiku'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category filter (optional subset) */}
      <div>
        <p className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400 mb-2">
          Category Filter <span className="normal-case font-normal">(leave empty for all categories)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => toggleCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-sans border transition-colors ${
                selectedCategories.includes(cat.value)
                  ? 'bg-charcoal text-paper border-charcoal'
                  : 'border-charcoal-200 text-charcoal-400 hover:border-charcoal hover:text-ink'
              }`}
            >
              {selectedCategories.includes(cat.value) && '✓ '}
              {cat.label}
            </button>
          ))}
        </div>
        {selectedCategories.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategories([])}
            className="mt-2 text-xs font-sans text-charcoal-400 hover:text-ink underline"
          >
            Clear selection (run all)
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm font-sans text-error">{error}</p>
      )}

      <button
        type="button"
        onClick={handleTrigger}
        disabled={disabled || triggering}
        className="h-12 px-6 bg-orange border border-charcoal text-paper font-sans uppercase text-xs tracking-widest font-bold hover:bg-orange/90 disabled:opacity-50 transition-colors shadow-[4px_4px_0px_0px_#121212] active:translate-y-0.5 active:shadow-none flex items-center gap-2"
      >
        {triggering ? 'Triggering...' : disabled ? 'Pipeline Active...' : `Trigger with ${provider === 'gemini' ? 'Gemini' : 'Claude'}`}
      </button>
    </div>
  );
}
