import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CATEGORY_VALUES = [
  'kitchen', 'edc', 'home', 'travel', 'tech', 'parenting', 'watches',
] as const;

const bodySchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1).max(200),
  category: z.enum(CATEGORY_VALUES),
  specs: z.unknown().optional(),
  scores: z.unknown().optional(),
  tones: z.array(z.string()).max(10),
  sourceLinks: z.string().optional(),
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.issues }, { status: 400 });
    }

    const { productName, category, specs, scores, tones, sourceLinks } = parsed.data;

    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash' });

    const prompt = `
      You are an expert product reviewer exclusively for BIFL365, a site dedicated to "Buy It For Life" products.
      Write a compelling, HTML-formatted product description for "${productName}" (Category: ${category}).

      The tone of this review must seamlessly blend the following narrative styles: ${tones.join(', ')}.

      If "reddit" is present, ensure a candid, authentic tone focusing on real-world durability.
      If "data" is present, emphasize the specifications and material facts.
      If "story" is present, craft a short narrative about discovering or living with the item.

      Here are the product's internal BIFL scores (out of 20):
      ${JSON.stringify(scores)}

      Here are the basic specs:
      ${JSON.stringify(specs)}

      IMPORTANT: The admin has provided the following raw quotes and links from around the web:
      """
      ${sourceLinks ?? ''}
      """
      If source links or quotes are provided, you MUST weave them organically into the narrative. Hyperlink the domains where appropriate, and use the quotes as social proof (e.g. "As one user on Reddit noted, [quote]"). Make sure to wrap links in <a href="..." target="_blank"> tags.

      Output ONLY the HTML <p> and <ul> tags. Do NOT wrap in \`\`\`html. Make it engaging, professional, and convincing for someone looking for a lifetime purchase.
    `;

    const result = await model.generateContent(prompt);
    let newDescription = result.response.text();

    // Clean up potential markdown formatting
    if (newDescription.startsWith('\`\`\`html')) {
      newDescription = newDescription.replace('\`\`\`html', '').replace('\`\`\`', '').trim();
    } else if (newDescription.startsWith('\`\`\`')) {
      newDescription = newDescription.replace('\`\`\`', '').replace('\`\`\`', '').trim();
    }

    return NextResponse.json({ newDescription });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Rewrite failed' }, { status: 500 });
  }
}
