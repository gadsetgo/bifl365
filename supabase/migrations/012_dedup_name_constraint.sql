-- Remove duplicates: keep the one with the latest created_at for each name
DELETE FROM products
WHERE id NOT IN (
  SELECT DISTINCT ON (lower(name)) id
  FROM products
  ORDER BY lower(name), created_at DESC
);

-- Drop the old week-based unique constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_name_week_of_key;

-- Add case-insensitive unique index on name (global, not per-week)
CREATE UNIQUE INDEX idx_products_name_ci ON products (lower(name));
