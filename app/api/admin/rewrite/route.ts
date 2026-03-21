import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { productId, productName, category, specs, scores, tones, sourceLinks } = await request.json();

    const prompt = `You are an expert product reviewer exclusively for BIFL365, a site dedicated to "Buy It For Life" products.
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
      ${sourceLinks}
      """
      If source links or quotes are provided, you MUST weave them organically into the narrative. Hyperlink the domains where appropriate, and use the quotes as social proof (e.g. "As one user on Reddit noted, [quote]"). Make sure to wrap links in <a href="..." target="_blank"> tags.

      Output ONLY the HTML <p> and <ul> tags. Do NOT wrap in \`\`\`html. Make it engaging, professional, and convincing for someone looking for a lifetime purchase.`;

    const message = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const newDescription = message.content[0]?.type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ newDescription });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
