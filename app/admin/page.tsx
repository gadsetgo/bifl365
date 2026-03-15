'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import { DraftEditor } from './components/DraftEditor';

export default function AdminDashboard() {
  const [drafts, setDrafts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    
    setDrafts(data || []);
    setLoading(false);
  }

  function handleDraftPublished(id: string) {
    // Remove from the local list
    setDrafts(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="bg-paper min-h-screen pb-20">
      <div className="border-b border-charcoal bg-charcoal text-paper p-6 lg:px-12">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="font-serif font-black text-3xl">BIFL365 Admin</h1>
            <p className="text-xs font-sans text-charcoal-400 mt-1 uppercase tracking-widest">Pipeline Review Queue</p>
          </div>
          <div className="flex gap-2">
            <span className="bg-orange text-paper px-3 py-1 font-bold text-sm tracking-widest uppercase">
              {drafts.length} Drafts
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {loading ? (
          <p className="text-charcoal-400 font-sans italic">Loading drafts pipeline...</p>
        ) : drafts.length === 0 ? (
          <div className="border border-charcoal p-12 text-center" style={{ boxShadow: '3px 3px 0px 0px #121212' }}>
            <p className="font-serif font-bold text-2xl text-ink">Queue Empty</p>
            <p className="text-sm font-sans text-charcoal-400 mt-2">All products have been published. Run the pipeline to pull fresh data.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {drafts.map(product => (
              <DraftEditor 
                key={product.id} 
                product={product} 
                onPublish={handleDraftPublished}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
