'use client';

import Link from 'next/link';

export default function TimeLoopDetectivePage() {
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
              Time-Loop Detective
            </h1>
            <p className="text-gray-600 mt-1">by Shubhi Bhatia</p>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] py-8 px-4">
        <iframe
          src="/games/teens/time-loop-detective.html"
          title="Time-Loop Detective"
          width="100%"
          height="800"
          frameBorder="0"
          allow="autoplay"
          className="border-2 border-orange rounded-lg shadow-lg max-w-4xl"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        />
      </div>

      {/* Footer */}
      <div className="bg-gray-100 py-4 px-4 text-center">
        <p className="text-gray-600 text-sm">
          Investigate clues across multiple time loops to solve the mystery!
        </p>
      </div>
    </main>
  );
}
