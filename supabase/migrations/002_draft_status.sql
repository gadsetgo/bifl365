-- Add a status column to support the Draft-Publish workflow
ALTER TABLE products 
ADD COLUMN status text NOT NULL DEFAULT 'published' 
CHECK (status IN ('draft', 'published'));

-- Index for querying published vs draft products efficiently
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
