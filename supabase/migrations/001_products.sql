-- Drop old table if exists (fresh start with new schema)
drop table if exists products;

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  category text not null check (category in ('kitchen','edc','home','travel','tech','parenting')),
  price_inr integer,
  price_usd integer,
  scores jsonb,
  specs jsonb,
  award_type text check (award_type in ('best_buy','forever_pick','hidden_gem')),
  affiliate_url_amazon text,
  affiliate_url_flipkart text,
  image_url text,
  summary text,
  reddit_sentiment text,
  week_of date,
  is_featured boolean default false,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz default now()
);

create index on products(category);
create index on products(week_of);
create index on products(status);
create index on products(is_featured) where is_featured = true;
