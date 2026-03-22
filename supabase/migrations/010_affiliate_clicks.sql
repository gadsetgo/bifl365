CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store       text NOT NULL,
  clicked_at  timestamptz DEFAULT now() NOT NULL,
  referrer    text,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS affiliate_clicks_product_id_idx ON affiliate_clicks(product_id);
CREATE INDEX IF NOT EXISTS affiliate_clicks_clicked_at_idx ON affiliate_clicks(clicked_at);
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_clicks" ON affiliate_clicks FOR INSERT TO anon WITH CHECK (true);
-- No SELECT for anon — admin reads use service role only
