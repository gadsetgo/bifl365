-- Migration 007: Rename 'best_buy' to 'value_buy' and add 'current_star'
-- Goal: Update branding and add trending product category.

-- 1. Drop existing constraint so we can update data
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_award_type_check;

-- 2. Migrate existing data FIRST (otherwise the new constraint will fail on existing 'best_buy' rows)
UPDATE products SET award_type = 'value_buy' WHERE award_type = 'best_buy';

-- 3. Add updated constraint
ALTER TABLE products ADD CONSTRAINT products_award_type_check 
CHECK (award_type IN ('value_buy', 'forever_pick', 'hidden_gem', 'current_star'));
