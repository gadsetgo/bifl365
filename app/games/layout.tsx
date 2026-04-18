import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'BIFL365 Games',
    template: '%s | BIFL365 Games',
  },
  description: 'Games by BIFL365 — fun and engaging games for all ages.',
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
