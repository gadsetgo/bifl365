import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range = '7' } = await searchParams;
  const days = range === '30' ? 30 : 7;

  const serviceClient = createServerSupabaseClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch clicks joined with product names
  const { data: clicks } = await serviceClient
    .from('affiliate_clicks')
    .select('product_id, store, clicked_at, products(name)')
    .gte('clicked_at', since)
    .order('clicked_at', { ascending: false });

  const rawClicks = (clicks ?? []) as unknown as {
    product_id: string;
    store: string;
    clicked_at: string;
    products: { name: string } | null;
  }[];

  // Aggregate by product + store
  const aggregateMap = new Map<string, { name: string; store: string; count: number; last: string }>();
  for (const c of rawClicks) {
    const key = `${c.product_id}::${c.store}`;
    if (!aggregateMap.has(key)) {
      aggregateMap.set(key, {
        name: c.products?.name ?? c.product_id,
        store: c.store,
        count: 0,
        last: c.clicked_at,
      });
    }
    const entry = aggregateMap.get(key)!;
    entry.count += 1;
    if (c.clicked_at > entry.last) entry.last = c.clicked_at;
  }

  const rows = [...aggregateMap.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif font-black text-3xl text-ink">Affiliate Analytics</h1>
          <p className="text-sm font-sans text-charcoal-400 mt-1">
            Click data for the last {days} days. Does not include IP addresses.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/analytics?range=7"
            className={`px-4 py-2 text-xs font-sans uppercase tracking-widest border transition-colors ${
              days === 7
                ? 'bg-charcoal text-paper border-charcoal'
                : 'border-charcoal text-ink hover:bg-paper-dark'
            }`}
          >
            7 Days
          </a>
          <a
            href="/admin/analytics?range=30"
            className={`px-4 py-2 text-xs font-sans uppercase tracking-widest border transition-colors ${
              days === 30
                ? 'bg-charcoal text-paper border-charcoal'
                : 'border-charcoal text-ink hover:bg-paper-dark'
            }`}
          >
            30 Days
          </a>
        </div>
      </div>

      {/* Total */}
      <div className="bg-white border border-charcoal p-6 inline-block" style={{ boxShadow: '4px 4px 0px 0px #E8E6E1' }}>
        <div className="text-4xl font-black text-ink mb-1">{rawClicks.length}</div>
        <div className="text-xs font-sans uppercase tracking-widest text-charcoal-400">Total Clicks ({days}d)</div>
      </div>

      {/* Table */}
      <div className="bg-white border border-charcoal shadow-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-charcoal text-paper text-[10px] font-sans uppercase tracking-widest">
              <th className="p-4 font-normal">Product</th>
              <th className="p-4 font-normal">Store</th>
              <th className="p-4 font-normal text-right">Clicks</th>
              <th className="p-4 font-normal">Most Recent</th>
            </tr>
          </thead>
          <tbody className="text-sm font-sans">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-charcoal-400">
                  No clicks recorded in the last {days} days.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="border-b border-ghost last:border-0 hover:bg-paper-dark transition-colors">
                  <td className="p-4 font-medium text-ink">{row.name}</td>
                  <td className="p-4 text-charcoal-400">{row.store}</td>
                  <td className="p-4 text-right font-bold text-orange">{row.count}</td>
                  <td className="p-4 text-charcoal-400">{new Date(row.last).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
