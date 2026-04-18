'use client';

import { useState } from 'react';

export function GamesToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isVercel = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_VERCEL === '1';

  const handleToggle = async (val: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ games_enabled: val }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEnabled(val);
      setMessage({ type: 'success', text: val ? 'Games section is now public.' : 'Games section is now hidden.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-sans font-semibold text-sm text-ink">Games visible to public</p>
          <p className="text-xs font-sans text-charcoal-400 mt-0.5">
            When off, visiting /games returns a 404 page.
          </p>
        </div>
        <button
          onClick={() => handleToggle(!enabled)}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? 'bg-orange' : 'bg-charcoal-400'
          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          aria-label="Toggle games visibility"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className={`px-4 py-2 text-xs font-sans border ${
        enabled
          ? 'bg-orange-pale text-orange border-orange'
          : 'bg-charcoal-100 text-charcoal-400 border-charcoal-300'
      }`}>
        {enabled ? '✓ Games section is LIVE at /games' : '✗ Games section is HIDDEN'}
      </div>

      {isVercel && (
        <p className="text-xs font-sans text-charcoal-400 bg-paper-dark border border-charcoal px-3 py-2">
          ⚠ On Vercel the config file is read-only. This toggle updates the file locally — commit and redeploy to take effect in production.
        </p>
      )}

      {message && (
        <p className={`text-xs font-sans ${message.type === 'success' ? 'text-orange' : 'text-error'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
