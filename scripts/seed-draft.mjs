import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedDraft() {
  const { data, error } = await supabase.from('products').insert([
    {
      name: 'Classic Chef Knife',
      brand: 'Wusthof',
      category: 'kitchen',
      price_inr: 12500,
      price_usd: 150,
      award_type: 'forever_pick',
      summary: 'This is an AI generated summary that needs editing by a human reviewer. The LLM missed the image url.',
      reddit_sentiment: 'Reddit loves how it holds an edge.',
      week_of: new Date().toISOString().split('T')[0],
      is_featured: false,
      status: 'draft',
      image_url: null,
      scores: {
        build_quality: 19,
        longevity: 20,
        value: 15,
        repairability: 18,
        india_availability: 12
      },
      specs: {
        material: 'High Carbon Steel',
        warranty: 'Lifetime',
        repairability_score: 9,
        made_in: 'Germany',
        weight: '250g'
      }
    }
  ]);

  if (error) {
    console.error('Failed to insert draft:', error);
  } else {
    console.log('Successfully inserted draft product for testing the Admin UI.');
  }
}

seedDraft();
