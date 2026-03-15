import { createClient } from '@supabase/supabase-js';
import type { Product } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Browser client — uses anon key, safe for client components
export const supabase = createClient<{ public: { Tables: { products: { Row: Product } } } }>(
  supabaseUrl,
  supabaseAnonKey
);

// Server client — uses service role key, for API routes and server actions only
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}
