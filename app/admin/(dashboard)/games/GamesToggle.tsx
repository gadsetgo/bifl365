'use client';

import { useState } from 'react';

interface Game {
  id: string;
  title: string;
  creator: string;
  category: string;
}

interface GamesToggleProps {
  initialEnabled: boolean;
  initialDisabledGames: string[];
  games: Game[];
}

export function GamesToggle({ initialEnabled, initialDisabledGames, games }: GamesToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [disabledGames, setDisabledGames] = useState<string[]>(initialDisabledGames);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const patch = async (body: object, successText: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage({ type: 'success', text: successText });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSectionToggle = async (val: boolean) => {
    await patch({ games_enabled: val }, val ? 'Games section is now public.' : 'Games section is now hidden.');
    setEnabled(val);
  };

  const handleGameToggle = async (gameId: string, currentlyDisabled: boolean) => {
    const next = currentlyDisabled
      ? disabledGames.filter((id) => id !== gameId)
      : [...disabledGames, gameId];
    await patch({ disabled_games: next }, currentlyDisabled ? `${gameId} enabled.` : `${gameId} disabled.`);
    setDisabledGames(next);
  };

  return (
    <div className="space-y-6">
      {/* Section master toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans font-semibold text-sm text-ink">Games section visible to public</p>
            <p className="text-xs font-sans text-charcoal-400 mt-0.5">
              When off, visiting /games returns a 404 page.
            </p>
          </div>
          <button
            onClick={() => handleSectionToggle(!enabled)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              enabled ? 'bg-orange' : 'bg-charcoal-400'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label="Toggle games section visibility"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <div className={`px-4 py-2 text-xs font-sans border ${
          enabled
            ? 'bg-orange-pale text-orange border-orange'
            : 'bg-paper-dark text-charcoal-400 border-ghost'
        }`}>
          {enabled ? '✓ Games section is LIVE at /games' : '✗ Games section is HIDDEN'}
        </div>
      </div>

      {/* Per-game toggles */}
      <div className="border border-ghost">
        <div className="px-4 py-2 bg-paper-dark border-b border-ghost text-[10px] font-sans uppercase tracking-widest text-charcoal-400 font-bold">
          Individual Games
        </div>
        <div className="divide-y divide-ghost">
          {games.map((game) => {
            const isDisabled = disabledGames.includes(game.id);
            return (
              <div key={game.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className={`text-sm font-sans font-medium ${isDisabled ? 'text-charcoal-400 line-through' : 'text-ink'}`}>
                    {game.title}
                  </p>
                  <p className="text-xs font-sans text-charcoal-400">
                    {game.category} · by {game.creator}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-sans uppercase tracking-widest font-bold ${
                    isDisabled ? 'text-charcoal-400' : 'text-orange'
                  }`}>
                    {isDisabled ? 'Off' : 'On'}
                  </span>
                  <button
                    onClick={() => handleGameToggle(game.id, isDisabled)}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      !isDisabled ? 'bg-orange' : 'bg-charcoal-400'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    aria-label={`Toggle ${game.title}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      !isDisabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {message && (
        <p className={`text-xs font-sans ${message.type === 'success' ? 'text-orange' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
