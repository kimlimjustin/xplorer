import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      username: string | null;
      subscriptionTier: 'FREE' | 'PRO';
    };
  }

  interface User {
    role: string;
    username: string | null;
    subscriptionTier: 'FREE' | 'PRO';
  }
}
