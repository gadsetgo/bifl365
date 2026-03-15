import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '700', '800', '900'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'BIFL365 — Buy It For Life | Products Built to Last, Reviewed for India',
    template: '%s | BIFL365',
  },
  description:
    'Weekly AI-curated Buy It For Life product awards for Indian buyers. Scored on build quality, longevity, repairability, value, and India availability.',
  keywords: ['BIFL', 'buy it for life', 'durable products', 'India', 'product reviews', 'lifetime warranty'],
  openGraph: {
    title: 'BIFL365 — Products Built to Last a Lifetime',
    description: 'Weekly AI-curated BIFL product awards for Indian buyers.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
