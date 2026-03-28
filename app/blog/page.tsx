import type { Metadata } from 'next';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { BlogPost } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog — BIFL365',
  description: 'Guides, reviews, and stories about products built to last a lifetime.',
};

export default async function BlogListingPage() {
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const posts = (data ?? []) as BlogPost[];

  return (
    <div className="bg-paper min-h-screen">
      <section className="border-b border-charcoal">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-orange" />
            <span className="section-label">Editorial</span>
          </div>
          <h1 className="font-serif font-black text-4xl md:text-5xl text-ink">Blog</h1>
          <p className="text-sm font-sans text-charcoal-400 mt-2 max-w-lg">
            Guides, reviews, and stories about products built to last a lifetime.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {posts.length === 0 ? (
          <p className="text-center text-charcoal-400 py-16 text-sm">No posts published yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="border border-charcoal bg-paper hover:bg-ghost/30 transition-colors group block"
                style={{ boxShadow: '2px 2px 0px 0px #121212' }}
              >
                {post.cover_image_url && (
                  <div className="aspect-[16/9] overflow-hidden border-b border-charcoal">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  {post.category && (
                    <span className="text-2xs font-sans uppercase tracking-widest text-orange mb-2 block">
                      {post.category}
                    </span>
                  )}
                  <h2 className="font-serif font-bold text-lg text-ink group-hover:text-orange transition-colors mb-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-xs text-charcoal-400 leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-2xs text-charcoal-400">
                    <span>{post.author_name}</span>
                    <span>·</span>
                    <span>
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : ''}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
