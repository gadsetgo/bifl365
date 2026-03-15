-- Migration 005: Add 'watches' to category check constraint

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE products ADD CONSTRAINT products_category_check 
CHECK (category in ('desk', 'kitchen', 'tools', 'carry', 'home', 'tech', 'edc', 'parenting', 'travel', 'watches'));
