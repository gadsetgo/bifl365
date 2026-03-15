import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { CategoryStrip } from '@/components/CategoryStrip';
import type { CategoryType, Product } from '@/lib/types';
import { VALID_CATEGORIES, CATEGORY_LABELS, CATEGORY_HOOKS } from '@/lib/constants';

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return VALID_CATEGORIES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = params.slug as CategoryType;
  if (!VALID_CATEGORIES.includes(cat)) return {};
  return {
    title: `${CATEGORY_LABELS[cat]} — BIFL Products`,
    description: `The best Buy It For Life products in the ${CATEGORY_LABELS[cat]} category, scored for Indian buyers.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const slug = params.slug as CategoryType;
  if (!VALID_CATEGORIES.includes(slug)) notFound();

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('category', slug)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const count = products?.length ?? 0;

  return (
    <div className="bg-paper min-h-screen">
      {/* Header */}
      <div className="border-b border-charcoal bg-charcoal text-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <span className="section-label text-charcoal-400 block mb-2">Category</span>
          <h1 className="font-serif font-black text-4xl text-paper">{CATEGORY_LABELS[slug]}</h1>
          <p className="text-xs font-sans text-charcoal-200 mt-2 italic">&quot;{CATEGORY_HOOKS[slug]}&quot;</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category navigation */}
        <div className="mb-8 pb-4 border-b border-ghost">
          <CategoryStrip activeCategory={slug} useNavigation />
        </div>

        {/* Count */}
        <div className="mb-5">
          <span className="section-label">{count} BIFL product{count !== 1 ? 's' : ''} in {CATEGORY_LABELS[slug]}</span>
        </div>

        {/* Grid */}
        {!products || products.length === 0 ? (
          <div className="py-20 text-center border border-charcoal">
            <p className="font-serif font-bold text-xl text-ink mb-2">No products yet</p>
            <p className="text-xs font-sans text-charcoal-400">
              Run <code className="bg-paper-dark border border-ghost px-1">npm run seed</code> or the pipeline to add {CATEGORY_LABELS[slug]} picks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
