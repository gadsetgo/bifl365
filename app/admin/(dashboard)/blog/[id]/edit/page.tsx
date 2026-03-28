import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { BlogPost } from '@/lib/types';
import { BlogEditorClient } from '../../BlogEditorClient';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditBlogPostPage({ params }: Props) {
  const { id } = await params;
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) notFound();

  return <BlogEditorClient post={data as BlogPost} mode="edit" />;
}
