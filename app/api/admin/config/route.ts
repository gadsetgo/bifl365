import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { auth } from '@/auth';

// NOTE: writeFileSync works locally and on self-hosted deployments.
// On Vercel serverless, the filesystem is read-only — config changes
// must be committed to git. A warning banner is shown in the UI when
// process.env.VERCEL is set.

const configPath = join(process.cwd(), 'bifl365.config.json');

const patchSchema = z.object({
  products_per_category: z.number().int().min(1).max(10).optional(),
  run_day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).optional(),
  run_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  auto_approve_mode: z.boolean().optional(),
  verify_links: z.boolean().optional(),
  research_provider: z.enum(['gemini', 'claude', 'ollama']).optional(),
  scoring_provider: z.enum(['gemini', 'claude', 'ollama', 'none']).optional(),
  content_provider: z.enum(['gemini', 'claude', 'ollama', 'none']).optional(),
  max_image_candidates: z.number().int().min(1).max(20).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  return NextResponse.json(config);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  config.pipeline = { ...config.pipeline, ...parsed.data };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return NextResponse.json(config);
}
