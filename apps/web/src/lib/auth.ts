import { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import GithubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { checkSponsorStatus, tierFromSponsor } from '@/lib/sponsors';

let _authOptions: NextAuthOptions | undefined;

export function getAuthOptions(): NextAuthOptions {
  if (_authOptions) return _authOptions;

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set');
  }

  _authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
      GithubProvider({
        clientId,
        clientSecret,
        profile(profile) {
          return {
            id: profile.id.toString(),
            name: profile.name || profile.login,
            email: profile.email,
            image: profile.avatar_url?.startsWith('https://avatars.githubusercontent.com/')
              ? profile.avatar_url
              : undefined,
            username: profile.login,
            role: 'USER',
            subscriptionTier: 'FREE',
          };
        },
      }),
    ],
    callbacks: {
      async signIn({ user, profile }) {
        // Auto-check GitHub Sponsors status on every sign-in
        const username = (profile as any)?.login || (user as any)?.username;
        if (username) {
          try {
            const status = await checkSponsorStatus(username);
            const tier = tierFromSponsor(status);
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id! },
              select: { subscriptionTier: true },
            });
            // Only update if sponsor status changed
            if (dbUser && dbUser.subscriptionTier !== tier) {
              await prisma.user.update({
                where: { id: user.id! },
                data: { subscriptionTier: tier },
              });
            }
          } catch (err) {
            console.error('[Auth] Failed to check sponsor status:', err);
          }
        }
        return true;
      },
      async session({ session, user }) {
        if (session.user) {
          session.user.id = user.id;
          session.user.role = (user as any).role || 'USER';
          session.user.username = (user as any).username || null;
          session.user.subscriptionTier = (user as any).subscriptionTier || 'FREE';
        }
        return session;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  };

  return _authOptions;
}

/**
 * Get the current server session. Use in Server Components and Route Handlers.
 */
export async function auth() {
  return getServerSession(getAuthOptions());
}

/**
 * Require an authenticated session. Throws if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Require admin role. Throws if not admin.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return session;
}
