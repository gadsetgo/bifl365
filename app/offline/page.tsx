'use client';

export default function OfflinePage() {
  return (
    <div className="bg-paper min-h-screen flex items-center justify-center px-4">
      <div className="text-center border border-charcoal p-12 max-w-sm w-full" style={{ boxShadow: '4px 4px 0px 0px #121212' }}>
        <div className="font-serif font-black text-2xl text-ink mb-1">
          BIFL<span className="text-orange">365</span>
        </div>
        <div className="w-12 h-px bg-orange mx-auto my-4" />
        <h1 className="font-serif font-bold text-xl text-ink mb-3">You&apos;re offline</h1>
        <p className="text-xs font-sans text-charcoal-400 leading-relaxed mb-6">
          No internet connection. Previously viewed products are still available in your cache.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary text-xs h-9 px-6 w-full"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
