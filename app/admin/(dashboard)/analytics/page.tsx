import { redirect } from 'next/navigation';

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  // Analytics merged into dashboard — redirect with range param preserved
  redirect('/admin');
}
