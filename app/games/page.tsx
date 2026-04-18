import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

function getGamesEnabled(): boolean {
  try {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'bifl365.config.json'), 'utf-8'));
    return config.games_enabled !== false;
  } catch {
    return true;
  }
}

interface Game {
  id: string;
  title: string;
  creator: string;
  description: string;
  link: string;
}

const preteensGames: Game[] = [
  {
    id: 'ring-or-drown',
    title: 'Ring or Drown in Lava',
    creator: 'Manya Bhatia',
    description: 'A thrilling game where you must navigate through rings while avoiding lava. Perfect for quick reflexes!',
    link: '/games/preteens/ring-or-drown',
  },
];

const teensGames: Game[] = [
  {
    id: 'time-loop-detective',
    title: 'Time-Loop Detective',
    creator: 'Shubhi Bhatia',
    description: 'A mystery game where you investigate clues across multiple time loops to solve the case.',
    link: '/games/teens/time-loop-detective',
  },
];

function GameCard({ game }: { game: Game }) {
  return (
    <Link href={game.link}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer border border-gray-200 hover:border-orange-500">
        <h3 className="text-xl font-semibold text-charcoal mb-2">{game.title}</h3>
        <p className="text-sm text-gray-600 mb-3">by {game.creator}</p>
        <p className="text-gray-700 text-sm mb-4">{game.description}</p>
        <div className="inline-block bg-orange text-white px-4 py-2 rounded text-sm font-medium hover:bg-opacity-90">
          Play Now →
        </div>
      </div>
    </Link>
  );
}

export default function GamesPage() {
  if (!getGamesEnabled()) notFound();

  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-charcoal mb-4" style={{ fontFamily: 'Playfair Display' }}>
            Games
          </h1>
          <p className="text-lg text-gray-600">
            Discover fun, engaging games crafted for different ages.
          </p>
        </div>

        {/* Preteens Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-charcoal mb-8" style={{ fontFamily: 'Playfair Display' }}>
            Games for Preteens
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {preteensGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          {preteensGames.length === 0 && (
            <p className="text-gray-500 text-center py-8">Coming soon...</p>
          )}
        </section>

        {/* Teens Section */}
        <section>
          <h2 className="text-3xl font-bold text-charcoal mb-8" style={{ fontFamily: 'Playfair Display' }}>
            Games for Teens
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teensGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          {teensGames.length === 0 && (
            <p className="text-gray-500 text-center py-8">Coming soon...</p>
          )}
        </section>
      </div>
    </main>
  );
}
