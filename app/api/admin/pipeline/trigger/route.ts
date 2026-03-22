import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

const triggerSchema = z.object({
  provider: z.enum(['gemini', 'claude']),
  categories: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.json();
  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
  }

  const { provider, categories } = parsed.data;
  const serviceClient = createServerSupabaseClient();

  // Insert pipeline run record
  const { data: runData, error: insertError } = await serviceClient
    .from('pipeline_runs')
    .insert([{ status: 'running' } as never])
    .select()
    .limit(1);

  if (insertError || !runData?.[0]) {
    return NextResponse.json({ error: 'Failed to create run record' }, { status: 500 });
  }

  const run = runData[0] as { id: string };

  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;

  if (owner && repo && token) {
    // Build workflow inputs — categories filter is passed as a comma-separated env var
    // The workflow must define these as workflow_dispatch inputs
    const inputs: Record<string, string> = {
      PIPELINE_RESEARCH_PROVIDER: provider,
      PIPELINE_SCORING_PROVIDER: provider,
      PIPELINE_CONTENT_PROVIDER: provider,
    };
    if (categories && categories.length > 0) {
      inputs.PIPELINE_CATEGORY_FILTER = categories.join(',');
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/weekly.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main', inputs }),
        }
      );
      if (!res.ok) throw new Error(`GH Actions dispatch failed: ${res.status}`);
    } catch (e: any) {
      console.error('Failed to trigger GH action', e);
      await serviceClient
        .from('pipeline_runs')
        .update({ status: 'failed', error_message: e.message } as never)
        .eq('id', run.id);
      return NextResponse.json({ error: 'Failed to dispatch workflow' }, { status: 502 });
    }
  }

  return NextResponse.json({ run_id: run.id, provider, categories });
}
