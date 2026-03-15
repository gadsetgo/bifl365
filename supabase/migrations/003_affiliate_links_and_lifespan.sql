-- Migration 003: Add affiliate links JSON array and estimated lifespan

ALTER TABLE products 
ADD COLUMN affiliate_links jsonb DEFAULT '[]'::jsonb,
ADD COLUMN estimated_lifespan_multiplier numeric;

-- Migrate existing amazon/flipkart links if any into the new jsonb structure
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
