export type AwardType = 'value_buy' | 'forever_pick' | 'hidden_gem' | 'current_star';
export type CategoryType = 'kitchen' | 'edc' | 'home' | 'travel' | 'tech' | 'parenting' | 'watches';

export interface AffiliateLink {
  store: string;
  url: string;
  is_affiliate: boolean;
}

export interface ProductScores {
  build_quality: number;   // /20
  longevity: number;       // /20
  value: number;           // /20
  repairability: number;   // /20
  india_availability: number; // /20
}

export interface ProductSpecs {
  material?: string;          // e.g. "Full-grain leather"
  warranty?: string;          // e.g. "Lifetime" or "25 years"
  repairability_score?: number; // 1–10
  made_in?: string;           // e.g. "Germany", "USA"
  weight?: string;            // e.g. "1.2 kg"
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: CategoryType;
  price_inr: number | null;
  price_usd: number | null;
  scores: ProductScores | null;
  specs: ProductSpecs | null;
  award_type: AwardType | null;
  affiliate_links: AffiliateLink[] | null;
  affiliate_url_amazon?: string | null;
  affiliate_url_flipkart?: string | null;
  estimated_lifespan_multiplier: number | null;
  estimated_lifespan_years: number | null;
  image_url: string | null;
  summary: string | null;
  reddit_sentiment: string | null;
  week_of: string | null;
  is_featured: boolean;
  featured_until?: string | null;
  status: 'draft' | 'published';
  created_at: string;
  image_candidates?: string[];
  image_approved?: boolean;
  pipeline_status?: 'pending_review' | 'approved' | 'rejected' | 'live';
  admin_notes?: string | null;
  description_draft?: string | null;
  video_url?: string | null;
  reviewed_at?: string | null;
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'status'> & {
  id?: string;
  created_at?: string;
  status?: 'draft' | 'published';
};
