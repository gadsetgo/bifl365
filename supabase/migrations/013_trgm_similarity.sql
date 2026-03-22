-- Enable trigram extension for fuzzy name matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for fast trigram similarity searches
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Function to find products with similar names
CREATE OR REPLACE FUNCTION find_similar_products(
  target_name TEXT,
  similarity_threshold FLOAT DEFAULT 0.4,
  max_results INT DEFAULT 5,
  exclude_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, name TEXT, brand TEXT, category TEXT, similarity FLOAT)
LANGUAGE sql STABLE
AS $$
  SELECT p.id, p.name, p.brand, p.category::TEXT,
         similarity(lower(p.name), lower(target_name)) AS similarity
  FROM products p
  WHERE similarity(lower(p.name), lower(target_name)) > similarity_threshold
    AND (exclude_id IS NULL OR p.id != exclude_id)
  ORDER BY similarity DESC
  LIMIT max_results;
$$;
