"use client"

import { useState } from "react";

interface PromptCardProps {
  name: string;
  provider: string;
  badge: string;
  description: string;
  prompt: string;
}

export default function PromptCard({ name, provider, badge, description, prompt }: PromptCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <div className="bg-white border border-charcoal p-5 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif font-black text-xl text-ink">{name}</h2>
          <p className="text-sm font-sans text-charcoal-400 mt-2">{description}</p>
        </div>
        <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold border shrink-0 ${badge}`}>
          {provider}
        </span>
      </div>

      <div className="border border-ghost bg-charcoal text-paper p-3 overflow-x-auto max-h-64 overflow-y-auto relative">
        <div className="text-[10px] uppercase tracking-widest text-charcoal-200 mb-2">
          Prompt — replace &quot;Casio F91W&quot; + &quot;watches&quot; with your product
        </div>
        <code className="text-xs font-mono whitespace-pre-wrap break-all">{prompt}</code>
        <button
          onClick={copyToClipboard}
          className="absolute top-2 right-2 bg-paper border border-charcoal text-charcoal px-2 py-1 text-xs font-sans hover:bg-paper-dark transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
