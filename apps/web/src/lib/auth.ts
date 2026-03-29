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
    session: { strategy: 'jwt' },
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
      async signIn({ user, account, profile }) {
        // Allow OAuth account linking when email matches an existing user
        if (account && profile?.email) {
          const existing = await prisma.user.findUnique({
            where: { email: profile.email },
            include: { accounts: true },
          });
          if (existing && !existing.accounts.some((a) => a.provider === account.provider)) {
            // Cast to access standard OAuth token fields from Partial<TokenSet>
            const oauthAccount = account as unknown as Record<string, unknown>;
            await prisma.account.create({
              data: {
                userId: existing.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: (oauthAccount.access_token as string) ?? null,
                refresh_token: (oauthAccount.refresh_token as string) ?? null,
                expires_at: (oauthAccount.expires_at as number) ?? null,
                token_type: (oauthAccount.token_type as string) ?? null,
                scope: (oauthAccount.scope as string) ?? null,
                id_token: (oauthAccount.id_token as string) ?? null,
                session_state: (oauthAccount.session_state as string) ?? null,
              },
            });
          }
        }

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
      async jwt({ token, user, profile }) {
        if (user) {
          token.id = user.id;
          token.role = (user as any).role || 'USER';
          token.username = (profile as any)?.login || (user as any).username || null;
          token.subscriptionTier = (user as any).subscriptionTier || 'FREE';
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && token) {
          session.user.id = token.id as string;
          session.user.role = (token.role as string) || 'USER';
          session.user.username = (token.username as string) || null;
          session.user.subscriptionTier = ((token.subscriptionTier as string) || 'FREE') as 'FREE' | 'PRO';
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
