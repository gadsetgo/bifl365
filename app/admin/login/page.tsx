import { signIn, auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) {
    redirect('/admin');
  }

  const { error } = await searchParams;
  const errorMsg = error === 'AccessDenied'
    ? "Access Denied. You must use the authorized admin email."
    : error;

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-4">
      <div className="bg-paper p-8 border border-charcoal max-w-sm w-full relative" style={{ boxShadow: '8px 8px 0px 0px rgba(0,0,0,0.5)' }}>
        <div className="absolute top-0 left-0 w-full h-1 bg-orange" />
        
        <div className="mb-8">
          <Link href="/" className="inline-block flex flex-col leading-none mb-6">
            <span className="font-serif font-black text-2xl text-ink tracking-tight">
              BIFL<span className="text-orange">365</span>
            </span>
            <span className="text-[10px] font-sans uppercase tracking-[0.15em] text-charcoal-400">Admin System</span>
          </Link>
          <h1 className="font-serif font-bold text-2xl text-ink">Sign In</h1>
          <p className="text-xs font-sans text-charcoal-400 mt-2">Restricted access explicitly for the site owner.</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-orange-pale border border-orange text-orange text-xs font-sans font-bold">
            {errorMsg}
          </div>
        )}

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/admin' });
          }}
        >
          <button
            type="submit"
            className="w-full btn-primary h-12 flex items-center justify-center gap-3 text-sm"
          >
            <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </form>

        <div className="mt-6 border-t border-ghost pt-4 text-center">
          <Link href="/" className="text-xs font-sans text-charcoal-400 hover:text-orange transition-colors">
            ← Back to public site
          </Link>
        </div>
      </div>
    </div>
  );
}
