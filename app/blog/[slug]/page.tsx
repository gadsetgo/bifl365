import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { BlogPost } from '@/lib/types';
import { renderMarkdown } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from('blog_posts')
    .select('title, meta_title, meta_description, excerpt')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!data) return { title: 'Not Found — BIFL365' };
  const post = data as Pick<BlogPost, 'title' | 'meta_title' | 'meta_description' | 'excerpt'>;

  return {
    title: `${post.meta_title || post.title} — BIFL365`,
    description: post.meta_description || post.excerpt || '',
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!data) notFound();
  const post = data as BlogPost;

  return (
    <div className="bg-paper min-h-screen">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-2xs text-charcoal-400 mb-6">
          <Link href="/blog" className="hover:text-orange transition-colors">Blog</Link>
          <span>/</span>
          <span className="truncate">{post.title}</span>
        </div>

        {/* Header */}
        {post.category && (
          <span className="text-2xs font-sans uppercase tracking-widest text-orange mb-3 block">
            {post.category}
          </span>
        )}
        <h1 className="font-serif font-black text-3xl md:text-4xl text-ink leading-tight mb-4">
          {post.title}
        </h1>
        <div className="flex items-center gap-3 text-xs text-charcoal-400 mb-8 pb-6 border-b border-charcoal-200">
          <span className="font-semibold text-ink">{post.author_name}</span>
          <span>·</span>
          <time>
            {post.published_at
              ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
              : ''}
          </time>
        </div>

        {/* Cover Image */}
        {post.cover_image_url && (
          <div className="mb-8 border border-charcoal overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image_url} alt={post.title} className="w-full" />
          </div>
        )}

        {/* Content */}
        <div
          className="prose-bifl"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-charcoal-200">
          <Link href="/blog" className="text-sm text-orange hover:underline">
            ← Back to Blog
          </Link>
        </div>
      </article>
    </div>
  );
}
