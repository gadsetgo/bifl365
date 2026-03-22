import { supabase, createServerSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range = '7' } = await searchParams;
  const days = range === '30' ? 30 : range === '90' ? 90 : 7;

  const serviceClient = createServerSupabaseClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: liveCount },
    { count: pendingCount },
    { count: imagesCount },
    { count: rejectedCount },
    { data: pipelineRun },
    { count: clicksToday },
    { data: clicks },
    { count: totalProducts },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('pipeline_status', 'live'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('pipeline_status', 'pending_review'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('image_approved', false).eq('pipeline_status', 'live'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('pipeline_status', 'rejected'),
    supabase.from('pipeline_runs').select('status, started_at, completed_at').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    serviceClient.from('affiliate_clicks').select('*', { count: 'exact', head: true }).gte('clicked_at', todayStart.toISOString()),
    serviceClient.from('affiliate_clicks').select('product_id, store, clicked_at, products(name)').gte('clicked_at', since).order('clicked_at', { ascending: false }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
  ]);

  type PipelineRun = { status: string; started_at: string; completed_at: string | null };
  const run = pipelineRun as unknown as PipelineRun | null;

  const hasPending = (pendingCount ?? 0) > 0;
  const hasImagesPending = (imagesCount ?? 0) > 0;

  // Aggregate clicks by product + store
  const rawClicks = (clicks ?? []) as unknown as {
    product_id: string;
    store: string;
    clicked_at: string;
    products: { name: string } | null;
  }[];

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
  const clickRows = [...aggregateMap.values()].sort((a, b) => b.count - a.count);

  // Aggregate clicks by store for summary
  const storeMap = new Map<string, number>();
  for (const c of rawClicks) {
    storeMap.set(c.store, (storeMap.get(c.store) ?? 0) + 1);
  }
  const storeBreakdown = [...storeMap.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-5xl space-y-8 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">BIFL365 Operations</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2">
          Live metrics, affiliate analytics, and pipeline status.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 border border-charcoal relative" style={{ boxShadow: '4px 4px 0px 0px #E8E6E1' }}>
          <div className="text-3xl font-black text-ink mb-1">{liveCount ?? 0}</div>
          <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400">Published</div>
          <div className="text-[10px] font-sans text-charcoal-300 mt-1">{totalProducts ?? 0} total</div>
        </div>

        <div
          className={`bg-white p-5 border relative transition-all ${hasPending ? 'border-orange' : 'border-charcoal'}`}
          style={{ boxShadow: hasPending ? '4px 4px 0px 0px rgba(193,127,36,0.5)' : '4px 4px 0px 0px #E8E6E1' }}
        >
          <div className={`text-3xl font-black mb-1 ${hasPending ? 'text-orange' : 'text-ink'}`}>
            {pendingCount ?? 0}
          </div>
          <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400">Pending Review</div>
          {hasPending && (
            <Link href="/admin/board?tab=pending" className="absolute top-3 right-3 text-orange hover:text-orange-hover">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          )}
        </div>

        <div
          className={`bg-white p-5 border relative transition-all ${hasImagesPending ? 'border-orange' : 'border-charcoal'}`}
          style={{ boxShadow: hasImagesPending ? '4px 4px 0px 0px rgba(193,127,36,0.5)' : '4px 4px 0px 0px #E8E6E1' }}
        >
          <div className={`text-3xl font-black mb-1 ${hasImagesPending ? 'text-orange' : 'text-ink'}`}>
            {imagesCount ?? 0}
          </div>
          <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400">Images Pending</div>
          {hasImagesPending && (
            <Link href="/admin/board?tab=needs_image" className="absolute top-3 right-3 text-orange hover:text-orange-hover">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          )}
        </div>

        <div className="bg-white p-5 border border-charcoal relative" style={{ boxShadow: '4px 4px 0px 0px #E8E6E1' }}>
          <div className="text-3xl font-black text-charcoal-400 mb-1">{rejectedCount ?? 0}</div>
          <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400">Rejected</div>
        </div>

        <div className="bg-white p-5 border border-charcoal relative" style={{ boxShadow: '4px 4px 0px 0px #E8E6E1' }}>
          <div className="text-3xl font-black text-orange mb-1">{clicksToday ?? 0}</div>
          <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400">Clicks Today</div>
        </div>
      </div>

      {/* Last Pipeline Run */}
      {run && (
        <div className="bg-paper-dark border border-charcoal p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between text-sm font-sans">
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ${
                run.status === 'success'
                  ? 'bg-orange-pale text-orange border-orange'
                  : run.status === 'failed'
                    ? 'bg-error-light text-error border-error'
                    : 'bg-charcoal-200 text-charcoal border-charcoal'
              }`}
            >
              {run.status}
            </span>
            <span className="text-ink font-medium">Last pipeline run</span>
          </div>
          <div className="flex items-center gap-4 text-charcoal-400 text-xs">
            <span>Started: {new Date(run.started_at).toLocaleString()}</span>
            {run.completed_at && (
              <span>Completed: {new Date(run.completed_at).toLocaleString()}</span>
            )}
            <Link href="/admin/pipeline" className="text-orange hover:underline font-bold uppercase tracking-widest">
              View
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/admin/board?tab=pending" className="flex items-center justify-between p-4 bg-charcoal text-paper hover:bg-charcoal-700 transition-colors border border-charcoal group">
          <span className="font-sans text-sm tracking-wide">Review Queue</span>
          <span className="text-orange group-hover:translate-x-1 transition-transform">&rarr;</span>
        </Link>
        <Link href="/admin/suggestions" className="flex items-center justify-between p-4 bg-paper-dark text-ink hover:bg-white transition-colors border border-charcoal group">
          <span className="font-sans text-sm tracking-wide">Submit Suggestion</span>
          <span className="text-charcoal-400 group-hover:translate-x-1 transition-transform">&rarr;</span>
        </Link>
        <Link href="/admin/pipeline" className="flex items-center justify-between p-4 bg-paper-dark text-ink hover:bg-white transition-colors border border-charcoal group">
          <span className="font-sans text-sm tracking-wide">Trigger Pipeline</span>
          <span className="text-charcoal-400 group-hover:translate-x-1 transition-transform">&rarr;</span>
        </Link>
      </div>

      {/* Affiliate Analytics */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-serif font-bold text-xl text-ink">Affiliate Clicks</h2>
            <p className="text-xs font-sans text-charcoal-400 mt-1">
              {rawClicks.length} clicks in the last {days} days
            </p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <a
                key={d}
                href={`/admin?range=${d}`}
                className={`px-3 py-1.5 text-[10px] font-sans uppercase tracking-widest border transition-colors ${
                  days === d
                    ? 'bg-charcoal text-paper border-charcoal'
                    : 'border-charcoal text-ink hover:bg-paper-dark'
                }`}
              >
                {d}d
              </a>
            ))}
          </div>
        </div>

        {/* Store breakdown */}
        {storeBreakdown.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {storeBreakdown.map(([store, count]) => (
              <div key={store} className="bg-white border border-charcoal px-4 py-3 inline-block" style={{ boxShadow: '3px 3px 0px 0px #E8E6E1' }}>
                <div className="text-xl font-black text-ink">{count}</div>
                <div className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400">{store}</div>
              </div>
            ))}
          </div>
        )}

        {/* Clicks table */}
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
              {clickRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-charcoal-400">
                    No clicks recorded in the last {days} days.
                  </td>
                </tr>
              ) : (
                clickRows.map((row, idx) => (
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
    </div>
  );
}
