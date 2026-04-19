'use client';

import Link from 'next/link';

export default function RingOrDrownPage() {
  return (
    <main className="min-h-screen bg-charcoal">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/games" className="text-orange hover:opacity-80 text-sm font-medium mb-2 inline-block">
              ← Back to Games
            </Link>
            <h1 className="text-3xl font-bold text-charcoal" style={{ fontFamily: 'Playfair Display' }}>
              Ring or Drown in Lava
            </h1>
            <p className="text-gray-600 mt-1">by Manya Bhatia</p>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-8">
        <iframe
          src="/games/preteens/ring-or-drown.html"
          title="Ring or Drown in Lava"
          width="480"
          height="600"
          frameBorder="0"
          allow="autoplay"
          className="border-2 border-orange rounded-lg shadow-lg"
        />
      </div>

      {/* Footer */}
      <div className="bg-gray-100 py-4 px-4 text-center">
        <p className="text-gray-600 text-sm">
          Drag to aim (touch) or move mouse • Tap/Click to shoot • Tap while flying = Boost! • [Target Mode] Miss too much = Lava Mode!
        </p>
      </div>
    </main>
  );
}
