-- Migration 008: Admin System & Pipeline Integration
-- Goal: Expand the 'products' schema to support AI generation state and create tracking tables.

-- modify 'products' table for AI Pipeline
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_candidates jsonb DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_approved boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pipeline_status text DEFAULT 'live' CHECK (pipeline_status IN ('pending_review', 'approved', 'rejected', 'live'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_draft text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- create 'pipeline_runs' to log weekly automation execution
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  products_found integer DEFAULT 0,
  products_approved integer DEFAULT 0,
  output_files jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- create 'product_suggestions' for admin to input ideas directly to the next pipeline run
CREATE TABLE IF NOT EXISTS product_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  notes text,
  priority integer DEFAULT 1,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done')),
  created_at timestamptz DEFAULT now()
);

-- indexing for faster queue queries
CREATE INDEX IF NOT EXISTS products_pipeline_status_idx ON products(pipeline_status);
CREATE INDEX IF NOT EXISTS products_image_approved_idx ON products(image_approved);
