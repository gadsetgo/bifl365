import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    async signIn({ user }) {
      // Security Check: Only the authorized ADMIN_EMAIL can sign in.
      if (user.email === process.env.ADMIN_EMAIL) {
        return true;
      }
      // Return URL to redirect to with error param
      return '/admin/login?error=AccessDenied';
    }
  },
  providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
