import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function triggerPipeline() {
  'use server';

  // 1. Log to DB as 'running'
  const { data: run, error } = await supabase
    .from('pipeline_runs')
    .insert({ status: 'running' })
    .select()
    .single();

  if (error || !run) return;

  // 2. Trigger GitHub Action
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;

  if (owner && repo && token) {
     try {
       const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/weekly.yml/dispatches`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${token}`,
           'Accept': 'application/vnd.github.v3+json',
           'X-GitHub-Api-Version': '2022-11-28',
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({ ref: 'main' })
       });
       if (!res.ok) throw new Error('Failed to dispatch');
     } catch (e) {
       console.error("Failed to trigger GH action", e);
       await supabase.from('pipeline_runs').update({ status: 'failed' }).eq('id', run.id);
     }
  }

  revalidatePath('/admin/pipeline');
}

export default async function PipelinePage() {
  const { data: runs } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20);

  const isRunning = runs && runs.length > 0 && runs[0].status === 'running';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif font-black text-3xl text-ink">Pipeline Runner</h1>
          <p className="text-sm font-sans text-charcoal-400 mt-2">
            Manually trigger the Weekly AI Research pipeline via GitHub Actions.
          </p>
        </div>
        <form action={triggerPipeline}>
          <button 
             disabled={isRunning}
             className="h-12 px-6 bg-orange border border-charcoal text-paper font-sans uppercase text-xs tracking-widest font-bold hover:bg-orange-hover disabled:opacity-50 transition-colors shadow-[4px_4px_0px_0px_#121212] active:translate-y-0.5 active:shadow-none flex items-center gap-2"
          >
             {isRunning ? 'Pipeline is Active...' : '▶ Trigger Pipeline'}
          </button>
        </form>
      </div>

      <div className="bg-white border border-charcoal shadow-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-charcoal text-paper text-[10px] font-sans uppercase tracking-widest">
              <th className="p-4 font-normal">Status</th>
              <th className="p-4 font-normal">Started At</th>
              <th className="p-4 font-normal">Completed At</th>
              <th className="p-4 font-normal text-right">Products Found</th>
              <th className="p-4 font-normal text-right">Approved</th>
            </tr>
          </thead>
          <tbody className="text-sm font-sans">
            {runs?.length === 0 ? (
               <tr>
                 <td colSpan={5} className="p-8 text-center text-charcoal-400">No pipeline runs recorded.</td>
               </tr>
            ) : (
               runs?.map((run) => (
                 <tr key={run.id} className="border-b border-ghost last:border-0 hover:bg-paper-dark transition-colors">
                   <td className="p-4">
                      <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ${run.status === 'success' ? 'bg-orange-pale text-orange border-orange' : run.status === 'failed' ? 'bg-error-light text-error border-error' : 'bg-charcoal-200 text-charcoal border-charcoal'}`}>
                        {run.status}
                      </span>
                   </td>
                   <td className="p-4 text-charcoal-400">{new Date(run.started_at).toLocaleString()}</td>
                   <td className="p-4 text-charcoal-400">{run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}</td>
                   <td className="p-4 text-right font-bold text-ink">{run.products_found}</td>
                   <td className="p-4 text-right font-bold text-ink">{run.products_approved}</td>
                 </tr>
               ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
