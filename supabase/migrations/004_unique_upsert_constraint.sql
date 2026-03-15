-- Migration 004: Add Unique Constraint for Upserts

-- The UPSERT (ON CONFLICT) in our Next.js API route requires a unique constraint 
-- on the columns it checks. Let's add that so the weekly pipeline can safely overwrite drafts.

ALTER TABLE products
ADD CONSTRAINT products_name_week_of_key UNIQUE (name, week_of);
