'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BlogPost } from '@/lib/types';

export function BlogListClient({ initialPosts }: { initialPosts: BlogPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts(prev => prev.filter(p => p.id !== id));
    }
    setDeleting(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif font-bold text-2xl text-ink">Blog Posts</h1>
        <Link href="/admin/blog/new" className="btn-primary text-xs">
          + New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-charcoal-400">
          <p className="text-sm">No blog posts yet.</p>
          <Link href="/admin/blog/new" className="text-orange text-sm hover:underline mt-2 inline-block">
            Create your first post
          </Link>
        </div>
      ) : (
        <div className="border border-charcoal rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-charcoal text-paper text-left">
                <th className="px-4 py-3 font-sans font-semibold">Title</th>
                <th className="px-4 py-3 font-sans font-semibold w-24">Status</th>
                <th className="px-4 py-3 font-sans font-semibold w-36 hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 font-sans font-semibold w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-t border-charcoal-200 hover:bg-ghost/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-serif font-semibold text-ink truncate max-w-xs">{post.title}</p>
                    {post.excerpt && (
                      <p className="text-2xs text-charcoal-400 truncate max-w-xs mt-0.5">{post.excerpt}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-2xs font-semibold rounded-sm ${
                      post.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-charcoal-100 text-charcoal-400'
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-2xs text-charcoal-400 hidden sm:table-cell">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString()
                      : new Date(post.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="text-xs text-orange hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={deleting === post.id}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      {deleting === post.id ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
