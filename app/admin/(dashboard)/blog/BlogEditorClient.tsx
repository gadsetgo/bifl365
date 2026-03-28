'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BlogPost } from '@/lib/types';
import { renderMarkdown, generateSlug, generateExcerpt } from '@/lib/markdown';

type EditorProps = {
  post?: BlogPost;
  mode: 'create' | 'edit';
};

export function BlogEditorClient({ post, mode }: EditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url ?? '');
  const [category, setCategory] = useState(post?.category ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(post?.status ?? 'draft');
  const [authorName, setAuthorName] = useState(post?.author_name ?? 'BIFL365 Editorial');
  const [metaTitle, setMetaTitle] = useState(post?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(post?.meta_description ?? '');
  const [error, setError] = useState('');

  function handleTitleChange(val: string) {
    setTitle(val);
    if (mode === 'create' || slug === generateSlug(title)) {
      setSlug(generateSlug(val));
    }
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');

    const body = {
      title,
      slug: slug || generateSlug(title),
      content,
      excerpt: excerpt || generateExcerpt(content),
      cover_image_url: coverImageUrl || null,
      category: category || null,
      status,
      author_name: authorName,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
    };

    try {
      const url = mode === 'create' ? '/api/admin/blog' : `/api/admin/blog/${post!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() ?? 'Failed to save');
        return;
      }
      router.push('/admin/blog');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm font-sans border border-charcoal bg-paper focus:outline-none focus:border-orange';
  const labelClass = 'block text-xs font-sans font-semibold text-charcoal-400 uppercase tracking-wider mb-1';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif font-bold text-2xl text-ink">
          {mode === 'create' ? 'New Blog Post' : 'Edit Post'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview(!preview)}
            className="btn-ghost text-xs border-charcoal"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm">
          {error}
        </div>
      )}

      {preview ? (
        <div className="border border-charcoal bg-paper p-6 rounded-sm">
          <h1 className="font-serif font-bold text-3xl text-ink mb-2">{title || 'Untitled'}</h1>
          <p className="text-xs text-charcoal-400 mb-6">{authorName} · {status}</p>
          <div
            className="prose-bifl"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              className={inputClass}
              placeholder="Post title"
            />
          </div>

          {/* Slug */}
          <div>
            <label className={labelClass}>Slug</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              className={inputClass}
              placeholder="url-slug"
            />
          </div>

          {/* Content */}
          <div>
            <label className={labelClass}>Content (Markdown)</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className={`${inputClass} min-h-[400px] font-mono`}
              placeholder="Write your post in markdown..."
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className={labelClass}>Excerpt</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              className={`${inputClass} h-20`}
              placeholder="Auto-generated if left blank"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cover Image URL */}
            <div>
              <label className={labelClass}>Cover Image URL</label>
              <input
                type="text"
                value={coverImageUrl}
                onChange={e => setCoverImageUrl(e.target.value)}
                className={inputClass}
                placeholder="https://..."
              />
            </div>

            {/* Category */}
            <div>
              <label className={labelClass}>Category</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputClass}
                placeholder="e.g., guides, reviews, news"
              />
            </div>

            {/* Author */}
            <div>
              <label className={labelClass}>Author</label>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Status */}
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'draft' | 'published')}
                className={inputClass}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* SEO */}
          <div className="border-t border-charcoal-200 pt-4 mt-4">
            <p className="section-label mb-3">SEO</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Meta Title</label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={e => setMetaTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Defaults to post title"
                />
              </div>
              <div>
                <label className={labelClass}>Meta Description</label>
                <input
                  type="text"
                  value={metaDescription}
                  onChange={e => setMetaDescription(e.target.value)}
                  className={inputClass}
                  placeholder="Defaults to excerpt"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
