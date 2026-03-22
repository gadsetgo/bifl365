import { supabase } from '@/lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ScheduleEditor } from './ScheduleEditor';
import { PipelineTriggerForm } from './PipelineTriggerForm';
import { ExternalAICreator } from './ExternalAICreator';
import { AFFILIATE_TAG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type PipelineRun = {
  id: string;
  status: 'running' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  products_found: number | null;
  products_approved: number | null;
  error_message: string | null;
  error_log: string | null;
};


const modes = [
  {
    name: 'Online Gemini',
    badge: 'UI Trigger',
    description: 'Runs the GitHub Actions workflow. The only mode triggerable from this screen without terminal access.',
    command: 'npm run pipeline:online',
    source: 'Fresh online research via Gemini',
    scoring: 'Gemini',
    content: 'Gemini'
  },
  {
    name: 'Local Ollama',
    badge: 'Terminal',
    description: 'Fully offline. Best for rapid iteration on the same machine where Ollama is installed. Swap models with OLLAMA_MODEL=qwen2.5:3b for faster runs.',
    command: 'npm run pipeline',
    source: 'Local Ollama generation',
    scoring: 'Ollama',
    content: 'Ollama'
  },
  {
    name: 'Imported Research',
    badge: 'Terminal',
    description: 'Drop a JSON file from ChatGPT, Claude, Gemini, or your own notes into research-drop. Use pipeline:dropbox to score with Ollama, or pipeline:dropbox:publish when the JSON already has scoring.',
    command: 'npm run pipeline:dropbox',
    source: 'Imported JSON bundle',
    scoring: 'Ollama (default, overridable)',
    content: 'Ollama (default, overridable)'
  }
];

function InfoCard({
  name, badge, description, command, source, scoring, content
}: {
  name: string; badge: string; description: string;
  command: string; source: string; scoring: string; content: string;
}) {
  return (
    <div className="bg-white border border-charcoal p-5 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif font-black text-xl text-ink">{name}</h2>
          <p className="text-sm font-sans text-charcoal-400 mt-2">{description}</p>
        </div>
        <span className="px-2 py-1 text-[10px] uppercase tracking-widest font-bold border bg-paper-dark text-charcoal border-charcoal shrink-0">
          {badge}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-sans">
        <div className="border border-ghost p-3 bg-paper-dark">
          <div className="text-[10px] uppercase tracking-widest text-charcoal-400 mb-1">Research</div>
          <div className="text-ink">{source}</div>
        </div>
        <div className="border border-ghost p-3 bg-paper-dark">
          <div className="text-[10px] uppercase tracking-widest text-charcoal-400 mb-1">Scoring</div>
          <div className="text-ink">{scoring}</div>
        </div>
        <div className="border border-ghost p-3 bg-paper-dark">
          <div className="text-[10px] uppercase tracking-widest text-charcoal-400 mb-1">Content</div>
          <div className="text-ink">{content}</div>
        </div>
      </div>

      <div className="border border-ghost bg-charcoal text-paper p-3 overflow-x-auto">
        <div className="text-[10px] uppercase tracking-widest text-charcoal-200 mb-2">Run Command</div>
        <code className="text-xs font-mono whitespace-pre-wrap break-all">{command}</code>
      </div>
    </div>
  );
}

export default async function PipelinePage() {
  const { data } = await supabase.from('pipeline_runs').select('*').order('started_at', { ascending: false }).limit(20);
  const runs = (data ?? []) as unknown as PipelineRun[];
  const isRunning = runs.length > 0 && runs[0].status === 'running';

  const config = JSON.parse(readFileSync(join(process.cwd(), 'bifl365.config.json'), 'utf-8'));

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Pipeline Runner</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2 max-w-2xl">
          Three supported modes: online AI (UI trigger), local Ollama (terminal), and imported research bundles (drop JSON files into{' '}
          <code className="bg-white border border-ghost px-1 py-0.5 text-xs">research-drop/</code>).
          See <code className="bg-white border border-ghost px-1 py-0.5 text-xs">PIPELINE_GUIDEBOOK.md</code> for full details.
        </p>
      </div>

      {/* Trigger form — provider + category subset selection */}
      <PipelineTriggerForm disabled={isRunning} categories={config.categories} />

      {/* Mode Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {modes.map((mode) => (
          <InfoCard key={mode.name} {...mode} />
        ))}
      </div>

      {/* External AI Product Creator */}
      <ExternalAICreator
        affiliateTag={AFFILIATE_TAG}
        categories={config.categories.map((c: { value: string; label: string }) => ({ value: c.value, label: c.label }))}
      />

      {/* Schedule & Config Editor */}
      <ScheduleEditor initialConfig={config.pipeline} />

      {/* Pipeline Run History */}
      <div className="bg-white border border-charcoal shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-ghost">
          <h2 className="font-serif font-bold text-xl text-ink">Run History</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-charcoal text-paper text-[10px] font-sans uppercase tracking-widest">
              <th className="p-4 font-normal">Status</th>
              <th className="p-4 font-normal">Started</th>
              <th className="p-4 font-normal">Completed</th>
              <th className="p-4 font-normal text-right">Found</th>
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
                    {run.status === 'failed' && (run.error_message || run.error_log) ? (
                      <details className="group">
                        <summary className="cursor-pointer list-none inline-flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border bg-error-light text-error border-error">
                            failed
                          </span>
                          {run.error_message && (
                            <span className="text-xs text-error truncate max-w-[200px]">{run.error_message}</span>
                          )}
                        </summary>
                        {run.error_log && (
                          <pre className="mt-2 p-3 bg-charcoal text-paper font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {run.error_log}
                          </pre>
                        )}
                      </details>
                    ) : (
                      <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ${
                        run.status === 'success'
                          ? 'bg-orange-pale text-orange border-orange'
                          : run.status === 'failed'
                            ? 'bg-error-light text-error border-error'
                            : 'bg-charcoal-200 text-charcoal border-charcoal'
                      }`}>
                        {run.status}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-charcoal-400">{new Date(run.started_at).toLocaleString()}</td>
                  <td className="p-4 text-charcoal-400">
                    {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}
                  </td>
                  <td className="p-4 text-right font-bold text-ink">{run.products_found ?? '—'}</td>
                  <td className="p-4 text-right font-bold text-ink">{run.products_approved ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
