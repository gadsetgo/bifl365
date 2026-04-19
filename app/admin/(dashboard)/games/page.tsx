import { readFileSync } from 'fs';
import { join } from 'path';
import { GamesToggle } from './GamesToggle';

export const dynamic = 'force-dynamic';

const ALL_GAMES = [
  { id: 'catch-the-bone', title: 'Catch the Bone!', creator: 'Shubhi Bhatia', category: 'Preteens' },
  { id: 'ring-or-drown', title: 'Ring or Drown in Lava', creator: 'Manya Bhatia', category: 'Preteens' },
  { id: 'time-loop-detective', title: 'Time-Loop Detective', creator: 'Shubhi Bhatia', category: 'Teens' },
];

export default function AdminGamesPage() {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'bifl365.config.json'), 'utf-8'));
  const gamesEnabled: boolean = config.games_enabled !== false;
  const disabledGames: string[] = config.disabled_games ?? [];

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Games Settings</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2">
          Control public visibility of the /games section and individual games.
        </p>
      </div>

      <div className="bg-white border border-charcoal p-6" style={{ boxShadow: '4px 4px 0px 0px #E8E6E1' }}>
        <GamesToggle
          initialEnabled={gamesEnabled}
          initialDisabledGames={disabledGames}
          games={ALL_GAMES}
        />
      </div>

      <div className="bg-paper-dark border border-charcoal p-4 text-xs font-sans text-charcoal-400 space-y-1">
        <p>Games are served from <code className="bg-paper px-1">/public/games/</code> as static HTML files.</p>
        <p>Individual game toggles hide/show specific games while keeping the section live.</p>
      </div>
    </div>
  );
}
