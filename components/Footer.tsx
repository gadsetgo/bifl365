import Link from 'next/link';

import { CATEGORIES } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-charcoal bg-charcoal text-paper">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="col-span-1">
            <p className="font-serif font-black text-2xl text-paper">
              BIFL<span className="text-orange">365</span>
            </p>
            <p className="text-xs font-sans text-charcoal-200 mt-2 leading-relaxed max-w-xs">
              Weekly AI-curated product awards. Scored for Indian buyers on build quality, longevity, repairability, value, and local availability.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-orange" />
              <span className="text-2xs font-sans uppercase tracking-widest text-charcoal-200">New awards every Monday 4AM IST</span>
            </div>
          </div>

          {/* Categories */}
          <div>
            <p className="section-label text-charcoal-200 mb-4">Categories</p>
            <ul className="space-y-2">
              {CATEGORIES.filter(c => c.value !== 'all').map(({ value: slug, label }) => (
                <li key={slug}>
                  <Link
                    href={`/category/${slug}`}
                    className="text-xs font-sans text-charcoal-200 hover:text-orange transition-colors duration-150 flex items-center gap-2"
                  >
                    <span className="w-1 h-1 bg-charcoal-200 inline-block flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Site */}
          <div>
            <p className="section-label text-charcoal-200 mb-4">Site</p>
            <ul className="space-y-2">
              {[
                { href: '/products', label: 'All Products' },
                { href: '/weekly-pick', label: 'Weekly Pick' },
                { href: '/blog', label: 'Blog' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs font-sans text-charcoal-200 hover:text-orange transition-colors duration-150 flex items-center gap-2">
                    <span className="w-1 h-1 bg-charcoal-200 inline-block flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-10 pt-6 border-t border-charcoal-600">
          <p className="text-2xs font-sans text-charcoal-400 leading-relaxed">
            <strong className="text-charcoal-200">Affiliate Disclosure:</strong> BIFL365 earns commissions from Amazon Associates and Flipkart Affiliate links at no extra cost to you. Scores are AI-generated (Gemini + Claude) and for informational purposes only. Prices are indicative.
          </p>
          <p className="text-2xs font-sans text-charcoal-400 mt-2">© {new Date().getFullYear()} BIFL365</p>
        </div>
      </div>
    </footer>
  );
}
