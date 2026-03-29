import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { SITE_NAME } from '@/lib/constants';
import { SignInButton } from './SignInButton';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Sign In | ${SITE_NAME}`,
};

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sign in to {SITE_NAME}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Sign in with your GitHub account to publish extensions, leave reviews, and manage your
            subscriptions.
          </p>
        </div>

        <SignInButton />

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
