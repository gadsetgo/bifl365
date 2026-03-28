/**
 * Lightweight markdown → HTML renderer (no npm deps).
 * Supports: headings, bold, italic, links, images, unordered/ordered lists,
 * blockquotes, code (inline + fenced), horizontal rules, paragraphs.
 */

export function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      i++; // skip closing ```
      html.push(`<pre class="bg-charcoal text-paper p-4 rounded-sm overflow-x-auto text-sm font-mono my-4"><code${lang ? ` class="language-${lang}"` : ''}>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = inline(headingMatch[2]);
      const sizes: Record<number, string> = {
        1: 'text-3xl mt-8 mb-4',
        2: 'text-2xl mt-6 mb-3',
        3: 'text-xl mt-5 mb-2',
        4: 'text-lg mt-4 mb-2',
        5: 'text-base mt-3 mb-1',
        6: 'text-sm mt-3 mb-1',
      };
      html.push(`<h${level} class="font-serif font-bold text-ink ${sizes[level]}">${text}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      html.push('<hr class="border-t border-charcoal-200 my-6" />');
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote class="border-l-4 border-orange pl-4 italic text-charcoal-400 my-4">${inline(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*+]\s/, ''))}</li>`);
        i++;
      }
      html.push(`<ul class="list-disc list-inside space-y-1 my-4 text-ink">${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      html.push(`<ol class="list-decimal list-inside space-y-1 my-4 text-ink">${items.join('')}</ol>`);
      continue;
    }

    // Image (standalone line)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      html.push(`<figure class="my-6"><img src="${esc(imgMatch[2])}" alt="${esc(imgMatch[1])}" class="w-full rounded-sm" />${imgMatch[1] ? `<figcaption class="text-xs text-charcoal-400 mt-2 text-center">${esc(imgMatch[1])}</figcaption>` : ''}</figure>`);
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('```') &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p class="text-ink leading-relaxed my-3">${inline(paraLines.join(' '))}</p>`);
    }
  }

  return html.join('\n');
}

/** Escape HTML entities */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Process inline markdown: bold, italic, code, links, images */
function inline(text: string): string {
  return text
    // inline code (before other transforms)
    .replace(/`([^`]+)`/g, '<code class="bg-ghost px-1.5 py-0.5 text-sm font-mono rounded-sm">$1</code>')
    // images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="inline max-h-48 rounded-sm" />')
    // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-orange hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // bold+italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/** Generate a URL-safe slug from a title */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** Extract first ~160 chars as an excerpt from markdown content */
export function generateExcerpt(content: string, maxLen = 160): string {
  // Strip markdown syntax for plain text excerpt
  const plain = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}
