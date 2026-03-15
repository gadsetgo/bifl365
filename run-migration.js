const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let dbUrl = env.find(l => l.startsWith('DATABASE_URL='));

if (!dbUrl) {
    dbUrl = 'postgresql://postgres:postgres@localhost:54322/postgres'; // Default local supabase 
} else {
    dbUrl = dbUrl.split('=')[1].trim();
}

console.log('Connecting to:', dbUrl.replace(/:[^:@]*@/, ':***@'));

const client = new Client({
  connectionString: dbUrl,
});

async function run() {
  await client.connect();

  const ddl = `
    ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS affiliate_links jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS estimated_lifespan_multiplier java;
  `;

  // We change java to numeric
  const ddlFixed = `
    ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS affiliate_links jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS estimated_lifespan_multiplier numeric;

    UPDATE products
    SET affiliate_links = (
      SELECT jsonb_agg(link)
      FROM (
        SELECT jsonb_build_object('store', 'Amazon', 'url', affiliate_url_amazon, 'is_affiliate', true) as link WHERE affiliate_url_amazon IS NOT NULL
        UNION ALL
        SELECT jsonb_build_object('store', 'Flipkart', 'url', affiliate_url_flipkart, 'is_affiliate', true) as link WHERE affiliate_url_flipkart IS NOT NULL
      ) subquery
    )
    WHERE affiliate_url_amazon IS NOT NULL OR affiliate_url_flipkart IS NOT NULL;
  `;

  try {
    const res = await client.query(ddlFixed);
    console.log('Schema updated successfully', res);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}

run();
