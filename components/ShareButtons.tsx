'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  url: string;
  title: string;
  score?: number | null;
  awardType?: string | null;
  redditSentiment?: string | null;
}

const AWARD_LABELS: Record<string, string> = {
  value_buy: 'Value Buy',
  forever_pick: 'Forever Pick',
  hidden_gem: 'Hidden Gem',
  current_star: 'Current Star',
};

export function ShareButtons({ url, title, score, awardType }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const awardLabel = awardType ? AWARD_LABELS[awardType] ?? awardType : 'BIFL Pick';
  const scoreText = score != null ? ` | BIFL Score: ${score}/100` : '';
  const shareText = `${title} — ${awardLabel}${scoreText} #BIFL365`.slice(0, 240);
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(url);

  const openPopup = (shareUrl: string) => {
    window.open(shareUrl, 'share-popup', 'width=600,height=400,noopener,noreferrer');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-charcoal-400">Share</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => openPopup(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`)}
          className="px-3 py-1.5 text-xs font-sans border border-charcoal text-ink hover:bg-charcoal hover:text-paper transition-colors"
          aria-label="Share on X / Twitter"
        >
          X / Twitter
        </button>
        <button
          onClick={() => openPopup(`https://wa.me/?text=${encodedText}%20${encodedUrl}`)}
          className="px-3 py-1.5 text-xs font-sans border border-charcoal text-ink hover:bg-charcoal hover:text-paper transition-colors"
          aria-label="Share on WhatsApp"
        >
          WhatsApp
        </button>
        <button
          onClick={() => openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)}
          className="px-3 py-1.5 text-xs font-sans border border-charcoal text-ink hover:bg-charcoal hover:text-paper transition-colors"
          aria-label="Share on Facebook"
        >
          Facebook
        </button>
        <button
          onClick={() => openPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`)}
          className="px-3 py-1.5 text-xs font-sans border border-charcoal text-ink hover:bg-charcoal hover:text-paper transition-colors"
          aria-label="Share on LinkedIn"
        >
          LinkedIn
        </button>
        <button
          onClick={() => openPopup(`https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`)}
          className="px-3 py-1.5 text-xs font-sans border border-charcoal text-ink hover:bg-charcoal hover:text-paper transition-colors"
          aria-label="Share on Reddit"
        >
          Reddit
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs font-sans border border-charcoal text-ink hover:bg-charcoal hover:text-paper transition-colors"
          aria-label="Copy link"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  );
}
