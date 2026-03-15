-- Migration 006: Add estimated_lifespan_years

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS estimated_lifespan_years integer;
