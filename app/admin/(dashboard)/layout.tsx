import { auth, signOut } from '@/auth';
import { AdminSidebar } from '@/components/AdminSidebar';
import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/admin/login');

  const [
    { count: pendingReviewCount },
    { count: imagesPendingCount }
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('pipeline_status', 'pending_review'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('image_approved', false)
  ]);

  return (
    <div className="min-h-screen bg-paper flex flex-col md:flex-row relative">
      <AdminSidebar
        pendingReviewCount={pendingReviewCount ?? 0}
        imagesPendingCount={imagesPendingCount ?? 0}
      />
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Top Header */}
        <header className="h-14 bg-charcoal text-paper flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 sticky top-0 shadow-sm border-b border-charcoal-600">
          <div className="flex items-center gap-3 md:hidden">
            <span className="font-serif font-black text-lg tracking-tight">
              BIFL<span className="text-orange">365</span>
            </span>
          </div>
          <div className="hidden md:flex items-center">
            <span className="bg-orange text-paper text-[10px] font-sans uppercase tracking-widest px-2 py-0.5 rounded-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">
              Admin Interface
            </span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-xs font-sans text-charcoal-200 hidden sm:block">
              {session.user?.email}
            </span>
            <form action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}>
              <button type="submit" className="text-xs font-sans uppercase tracking-wider text-orange hover:text-orange-pale transition-colors font-bold">
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative pb-24 md:pb-8 bg-paper">
          {children}
        </main>
      </div>
    </div>
  );
}
