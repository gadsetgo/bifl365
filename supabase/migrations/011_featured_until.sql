-- Add featured_until column for admin override of featured product
ALTER TABLE products ADD COLUMN featured_until timestamptz DEFAULT NULL;
COMMENT ON COLUMN products.featured_until IS 'Override featured product until this datetime. NULL = no override.';
CREATE INDEX idx_products_featured_until ON products(featured_until) WHERE featured_until IS NOT NULL;
