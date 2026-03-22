#!/usr/bin/env node
// scripts/delete-stale.mjs — Deletes all products created before 2026-03-19

import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const CUTOFF = '2026-03-19T00:00:00.000Z';

async function deleteStale() {
  console.log(`\nDeleting products created before ${CUTOFF}...\n`);

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/products?created_at=lt.${CUTOFF}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation',
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('Delete failed:', err);
    process.exitCode = 1;
    return;
  }

  const deleted = await response.json();
  console.log(`Deleted ${deleted.length} stale product(s).`);
  if (deleted.length > 0) {
    deleted.forEach((p) => console.log(`  - [${p.category}] ${p.name}`));
  }
}

deleteStale();
