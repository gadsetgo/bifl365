import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [
    { count: liveCount },
    { count: pendingCount },
    { count: imagesCount },
    { data: pipelineRun }
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('pipeline_status', 'live'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('pipeline_status', 'pending_review'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('image_approved', false),
    supabase.from('pipeline_runs').select('status, started_at').order('started_at', { ascending: false }).limit(1).maybeSingle()
  ]);

  return (
    <div className="max-w-5xl space-y-8 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">BIFL365 Operations</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2">
          Monitor your AI curations, manage pending approvals, and trigger weekly pipelines.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-6 border border-charcoal relative" style={{ boxShadow: '4px 4px 0px 0px #E8E6E1' }}>
          <div className="text-4xl pr-4 font-black text-ink mb-1">{liveCount ?? 0}</div>
          <div className="text-xs font-sans uppercase tracking-widest text-charcoal-400">Live Products</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-6 border border-charcoal relative" style={{ boxShadow: '4px 4px 0px 0px rgba(193, 127, 36, 0.4)' }}>
          <div className="text-4xl pr-4 font-black text-orange mb-1">{pendingCount ?? 0}</div>
          <div className="text-xs font-sans uppercase tracking-widest text-charcoal-400">Pending Review</div>
          {pendingCount !== 0 && (
             <Link href="/admin/review" className="absolute top-4 right-4 text-orange hover:text-orange-hover">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
             </Link>
          )}
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-6 border border-charcoal relative" style={{ boxShadow: '4px 4px 0px 0px rgba(193, 127, 36, 0.4)' }}>
          <div className="text-4xl pr-4 font-black text-orange mb-1">{imagesCount ?? 0}</div>
          <div className="text-xs font-sans uppercase tracking-widest text-charcoal-400">Images Pending</div>
           {imagesCount !== 0 && (
             <Link href="/admin/images" className="absolute top-4 right-4 text-orange hover:text-orange-hover">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
             </Link>
          )}
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-6 border border-charcoal relative" style={{ boxShadow: '4px 4px 0px 0px #E8E6E1' }}>
          <div className="text-lg pr-4 font-bold text-ink mb-2 capitalize truncate">
            {pipelineRun ? pipelineRun.status : 'Never Run'}
          </div>
          <div className="text-xs font-sans uppercase tracking-widest text-charcoal-400">Last Pipeline</div>
          {pipelineRun && (
            <div className="mt-1 text-2xs text-charcoal-200">
              {new Date(pipelineRun.started_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-serif font-bold text-xl text-ink mb-4 border-b border-ghost pb-2">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/admin/review" className="flex items-center justify-between p-4 bg-charcoal text-paper hover:bg-charcoal-700 transition-colors border border-charcoal group">
              <span className="font-sans text-sm tracking-wide">Enter Review Queue</span>
              <span className="text-orange group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link href="/admin/suggestions" className="flex items-center justify-between p-4 bg-paper-dark text-ink hover:bg-white transition-colors border border-charcoal group">
              <span className="font-sans text-sm tracking-wide">Submit Suggestion</span>
              <span className="text-charcoal-400 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link href="/admin/pipeline" className="flex items-center justify-between p-4 bg-paper-dark text-ink hover:bg-white transition-colors border border-charcoal group">
              <span className="font-sans text-sm tracking-wide">Trigger Pipeline</span>
              <span className="text-charcoal-400 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
        </div>
      </div>
    </div>
  );
}
