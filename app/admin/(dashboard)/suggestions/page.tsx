import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { CATEGORIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

async function submitSuggestion(formData: FormData) {
  'use server';
  const name = formData.get('name') as string;
  const category = formData.get('category') as string;
  const notes = formData.get('notes') as string;
  const priority = Number(formData.get('priority') || 1);

  if (!name || !category) return;

  const { error } = await supabase.from('product_suggestions').insert({
    name,
    category,
    notes,
    priority,
    status: 'pending' // Enforces the constraint on the API level
  });

  if (error) console.error("Error inserting suggestion:", error.message);
  revalidatePath('/admin/suggestions');
}

async function markDone(id: string) {
  'use server';
  await supabase.from('product_suggestions').update({ status: 'done' }).eq('id', id);
  revalidatePath('/admin/suggestions');
}

async function deleteItem(id: string) {
  'use server';
  await supabase.from('product_suggestions').delete().eq('id', id);
  revalidatePath('/admin/suggestions');
}

export default async function SuggestionsPage() {
  const { data: suggestions } = await supabase
    .from('product_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-serif font-black text-3xl text-ink">Product Suggestions</h1>
        <p className="text-sm font-sans text-charcoal-400 mt-2">
          Queue up specific products or entire categories for the weekly AI pipeline to research.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Suggestion Form */}
        <div className="lg:col-span-1 bg-white p-6 border border-charcoal shadow-card sticky top-20">
          <h2 className="font-sans font-bold text-sm tracking-wide uppercase border-b border-ghost pb-2 mb-4">Add to Queue</h2>
          <form action={submitSuggestion} className="space-y-4">
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Product Name / Prompt</label>
              <input name="name" type="text" required className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none" placeholder="e.g. Herman Miller Aeron" />
            </div>
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Target Category</label>
              <select name="category" required className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white">
                 {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                   <option key={c.value} value={c.value}>{c.label}</option>
                 ))}
                 <option value="other">Other / General</option>
              </select>
            </div>
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Priority (1-3)</label>
              <select name="priority" className="w-full h-10 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white">
                <option value="1">1 - Standard</option>
                <option value="2">2 - High</option>
                <option value="3">3 - Urgent/Next Run</option>
              </select>
            </div>
            <div>
              <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-1">Additional Guidance</label>
              <textarea name="notes" className="w-full h-20 p-2 text-sm border border-charcoal focus:border-orange focus:outline-none resize-none" placeholder="Make sure it evaluates the 2024 model year..." />
            </div>
            <button type="submit" className="w-full h-10 bg-orange text-paper font-sans uppercase text-xs tracking-widest font-bold hover:bg-orange-hover transition-colors shadow-[4px_4px_0px_0px_#121212] active:translate-y-0.5 active:shadow-none">
              Submit to Queue
            </button>
          </form>
        </div>

        {/* Existing Pipeline Items */}
        <div className="lg:col-span-2 space-y-4">
           {suggestions?.length === 0 ? (
             <div className="py-12 text-center border border-dashed border-charcoal-200">
               <p className="text-sm font-sans text-charcoal-400">No pending suggestions.</p>
             </div>
           ) : (
             suggestions?.map((item) => (
               <div key={item.id} className={`p-4 border border-charcoal flex flex-col sm:flex-row justify-between gap-4 ${item.status === 'done' ? 'bg-ghost opacity-60' : 'bg-white'}`}>
                 <div>
                   <div className="flex items-center gap-2 mb-1">
                     <span className={`px-2 py-0.5 text-[9px] font-sans uppercase tracking-widest text-paper ${item.priority === 3 ? 'bg-orange' : item.priority === 2 ? 'bg-charcoal' : 'bg-charcoal-400'}`}>
                       Priority {item.priority}
                     </span>
                     <span className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400 px-2 border border-charcoal-200">
                       {item.category}
                     </span>
                     <span className="text-[10px] font-sans uppercase tracking-widest text-charcoal-400">
                       {item.status}
                     </span>
                   </div>
                   <h3 className="font-serif font-bold text-lg text-ink">{item.name}</h3>
                   {item.notes && <p className="text-xs text-charcoal-400 mt-1">{item.notes}</p>}
                 </div>
                 <div className="flex items-center gap-2 shrink-0">
                    {item.status !== 'done' && (
                      <form action={markDone.bind(null, item.id)}>
                        <button type="submit" className="px-3 py-1.5 border border-charcoal text-xs font-bold uppercase hover:bg-charcoal hover:text-paper transition-colors">Mark Done</button>
                      </form>
                    )}
                    <form action={deleteItem.bind(null, item.id)}>
                       <button type="submit" className="px-3 py-1.5 text-xs text-orange hover:underline font-bold">Delete</button>
                    </form>
                 </div>
               </div>
             ))
           )}
        </div>

      </div>
    </div>
  );
}
