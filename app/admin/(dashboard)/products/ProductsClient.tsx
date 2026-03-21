'use client';

import { useState } from 'react';
import type { Product } from '@/lib/types';

export function ProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Slide-in state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter products
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.pipeline_status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const updates = {
      name: formData.get('name'),
      brand: formData.get('brand'),
      category: formData.get('category'),
      pipeline_status: formData.get('pipeline_status'),
      award_type: formData.get('award_type') === 'none' ? null : formData.get('award_type'),
    };

    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const updated = await res.json();
      
      // Update local state
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Search items..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none"
        />
        <select 
          value={statusFilter} 
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white min-w-[200px]"
        >
          <option value="all">All Statuses</option>
          <option value="live">Live</option>
          <option value="pending_review">Pending Review</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-charcoal shadow-[4px_4px_0px_0px_#121212] overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-charcoal text-paper text-[10px] font-sans uppercase tracking-widest">
              <th className="p-4 font-normal">Product</th>
              <th className="p-4 font-normal">Category</th>
              <th className="p-4 font-normal">Pipeline Status</th>
              <th className="p-4 font-normal">Award</th>
              <th className="p-4 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm font-sans">
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-ghost last:border-0 hover:bg-paper-dark transition-colors">
                <td className="p-4 flex flex-col">
                  <span className="font-bold text-ink">{p.name}</span>
                  <span className="text-2xs text-charcoal-400">{p.brand}</span>
                </td>
                <td className="p-4 text-charcoal-400 capitalize">{p.category}</td>
                <td className="p-4">
                   <span className={`px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold border ${p.pipeline_status === 'live' ? 'bg-orange-pale text-orange border-orange' : 'bg-charcoal text-paper border-charcoal'}`}>
                      {p.pipeline_status}
                   </span>
                </td>
                <td className="p-4 text-charcoal-400">{p.award_type || '-'}</td>
                <td className="p-4 text-right">
                  <button onClick={() => setEditingProduct(p)} className="text-xs text-orange font-bold uppercase tracking-widest hover:underline">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-charcoal-400 text-sm font-sans">No products matched your search.</div>
        )}
      </div>

      {/* Slide-in Editor Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-charcoal/20 backdrop-blur-sm animate-fade-in">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => !isSaving && setEditingProduct(null)} />
          
          {/* Panel */}
          <div className="w-full max-w-md bg-white h-full border-l border-charcoal shadow-[-8px_0px_0px_0px_rgba(0,0,0,0.1)] relative flex flex-col overflow-y-auto">
            <div className="p-6 border-b border-ghost flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-serif font-black text-2xl text-ink">Edit Product</h2>
              <button disabled={isSaving} onClick={() => setEditingProduct(null)} className="text-2xl leading-none text-charcoal hover:text-orange">×</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4 flex-1">
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Name</label>
                <input name="name" defaultValue={editingProduct.name} required className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none" />
              </div>
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Brand</label>
                <input name="brand" defaultValue={editingProduct.brand} required className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Category</label>
                    <input name="category" defaultValue={editingProduct.category} required className="w-full h-10 px-3 text-sm border border-charcoal bg-paper-dark" readOnly />
                 </div>
                 <div>
                    <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Status</label>
                    <select name="pipeline_status" defaultValue={editingProduct.pipeline_status || 'live'} className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none">
                      <option value="pending_review">Pending Review</option>
                      <option value="live">Live</option>
                      <option value="rejected">Rejected</option>
                      <option value="approved">Approved</option>
                    </select>
                 </div>
              </div>
              <div>
                <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Award Override</label>
                <select name="award_type" defaultValue={editingProduct.award_type || 'none'} className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white">
                   <option value="none">No Award</option>
                   <option value="value_buy">Value Buy</option>
                   <option value="forever_pick">Forever Pick</option>
                   <option value="hidden_gem">Hidden Gem</option>
                   <option value="current_star">Current Star</option>
                </select>
              </div>
              {/* Other massive fields omitted in this compact editor */}
              
              <div className="pt-8 w-full sticky bottom-0 bg-white pb-6">
                <button type="submit" disabled={isSaving} className="w-full h-12 bg-charcoal text-paper font-bold text-xs uppercase tracking-widest hover:bg-orange disabled:opacity-50 transition-colors shadow-[4px_4px_0px_0px_rgba(255,87,51,0.5)] active:translate-y-0.5 active:shadow-none">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
