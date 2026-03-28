import { supabase } from '@/lib/supabase';
import type { BlogPost } from '@/lib/types';
import { BlogListClient } from './BlogListClient';

export const dynamic = 'force-dynamic';

export default async function BlogAdminPage() {
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  const posts = (data ?? []) as BlogPost[];

  return <BlogListClient initialPosts={posts} />;
}
