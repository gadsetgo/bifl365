-- Blog posts table
CREATE TABLE blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  excerpt text,
  cover_image_url text,
  category text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  author_name text NOT NULL DEFAULT 'BIFL365 Editorial',
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for public listing (published posts, newest first)
CREATE INDEX idx_blog_posts_published ON blog_posts (status, published_at DESC)
  WHERE status = 'published';

-- Index for slug lookup
CREATE INDEX idx_blog_posts_slug ON blog_posts (slug);
