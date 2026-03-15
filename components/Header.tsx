import Link from 'next/link';

const NAV_LINKS = [
  { href: '/products', label: 'All Products' },
  { href: '/weekly-pick', label: 'Weekly Pick' },
  { href: '/category/kitchen', label: 'Kitchen' },
  { href: '/category/edc', label: 'EDC' },
  { href: '/category/tech', label: 'Tech' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-paper border-b border-charcoal">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" id="header-logo" className="flex items-center gap-3 group">
            <div className="flex flex-col leading-none">
              <span className="font-serif font-black text-xl text-ink tracking-tight group-hover:text-orange transition-colors duration-150">
                BIFL<span className="text-orange group-hover:text-ink">365</span>
              </span>
            </div>
            <div className="hidden sm:block h-5 w-px bg-charcoal-200" />
            <span className="hidden sm:block text-2xs font-sans uppercase tracking-[0.15em] text-charcoal-400">
              Buy It For Life
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
                className="px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-charcoal-400 hover:text-ink hover:bg-paper-dark transition-colors duration-150 hidden md:block"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/weekly-pick"
              id="nav-weekly-cta"
              className="ml-2 btn-primary text-xs py-1.5 px-3"
            >
              This Week ◆
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
