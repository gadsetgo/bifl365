'use client';

import { useState } from 'react';

export function ImageClient({ initialProducts }: { initialProducts: any[] }) {
  const [queue, setQueue] = useState(initialProducts);
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeProduct = queue[currentIndex];
  
  const [customUrl, setCustomUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  if (!activeProduct) {
    return (
      <div className="py-20 text-center border border-charcoal bg-white shadow-[4px_4px_0px_0px_#121212]">
        <p className="font-serif font-bold text-xl text-ink mb-2">Queue Empty</p>
        <p className="text-sm font-sans text-charcoal-400">All media approved.</p>
      </div>
    );
  }

  const candidates: string[] = activeProduct.image_candidates || [];

  async function handleApprove(selectedUrl: string) {
    const finalImageUrl = customUrl.trim() || selectedUrl;
    
    // Optimistically proceed
    const currentId = activeProduct.id;
    setCurrentIndex(prev => prev + 1);
    setCustomUrl('');
    setVideoUrl('');

    try {
      await fetch(`/api/admin/products/${currentId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
           image_url: finalImageUrl, 
           image_approved: true,
           video_url: videoUrl.trim() || undefined
         })
      });
    } catch (err) {
      console.error(err);
      setCurrentIndex(prev => prev - 1);
    }
  }

  return (
    <div className="relative">
      <div className="mb-4 text-xs font-sans font-bold text-charcoal-400 uppercase tracking-widest flex justify-between">
        <span>Reviewing {currentIndex + 1} of {queue.length}</span>
        <button onClick={() => setCurrentIndex(p => p + 1)} className="hover:text-orange transition-colors">Skip →</button>
      </div>

      <div className="bg-white border border-charcoal p-6 lg:p-8 shadow-[8px_8px_0px_0px_#121212] flex flex-col gap-6">
        <div>
           <h2 className="font-serif font-bold text-2xl text-ink">{activeProduct.name}</h2>
           <p className="text-sm mt-1 text-charcoal-400 line-clamp-2">{activeProduct.summary}</p>
        </div>

        {/* Video Integration */}
        <div className="bg-paper-dark p-4 border border-ghost">
           <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-2">Attach Premium Video Review (Optional)</label>
           <input 
             type="url" 
             placeholder="https://youtube.com/watch?v=..."
             value={videoUrl}
             onChange={e => setVideoUrl(e.target.value)}
             className="w-full h-10 px-3 text-sm font-sans border border-charcoal focus:border-orange focus:outline-none bg-white"
           />
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {candidates.map((url, i) => (
             <div key={url} className={`relative border p-3 flex flex-col gap-3 ${i === 0 ? 'border-orange bg-orange-pale' : 'border-ghost bg-paper-dark'}`}>
               {i === 0 && (
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange text-paper px-3 py-1 text-[10px] font-sans uppercase tracking-widest shadow-sm whitespace-nowrap z-10">
                   ✦ Gemini Recommended ✦
                 </div>
               )}
               <div className="relative w-full aspect-square bg-ghost overflow-hidden border border-charcoal">
                 {/* Using native img tag because Unsplash URLs can be highly dynamic and next.config.mjs might not support all raw domains quickly. */}
                 <img src={url} alt="Candidate" className="absolute inset-0 w-full h-full object-cover" />
               </div>
               <button 
                 onClick={() => handleApprove(url)}
                 className={`w-full h-12 text-xs font-bold uppercase tracking-widest border transition-colors ${i === 0 ? 'bg-orange text-paper border-charcoal hover:bg-orange-hover shadow-[2px_2px_0px_0px_#121212] active:translate-y-0.5 active:shadow-none' : 'bg-white text-ink border-charcoal hover:bg-charcoal hover:text-paper shadow-[2px_2px_0px_0px_#121212] active:translate-y-0.5 active:shadow-none'}`}
               >
                 Approve This
               </button>
             </div>
           ))}
        </div>

        {/* Custom URL Override */}
        <div className="border-t border-ghost pt-6 mt-2">
           <label className="block text-2xs font-sans uppercase tracking-widest text-charcoal-400 mb-2">Or Provide Custom Image URL</label>
           <div className="flex gap-4">
             <input 
               type="url" 
               placeholder="https://..."
               value={customUrl}
               onChange={e => setCustomUrl(e.target.value)}
               className="flex-1 h-12 px-3 text-sm border border-charcoal focus:border-orange focus:outline-none bg-white"
             />
             <button 
               onClick={() => handleApprove(customUrl)}
               disabled={!customUrl.trim()}
               className="h-12 px-8 bg-charcoal text-paper font-bold text-xs uppercase tracking-widest hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
             >
               Approve Custom
             </button>
           </div>
        </div>

      </div>
    </div>
  )
}
