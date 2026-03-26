'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function SignInButton() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      onClick={() => {
        setLoading(true);
        signIn('github', { callbackUrl: '/dashboard' });
      }}
      loading={loading}
      size="lg"
      className="w-full"
    >
      <Github className="h-5 w-5" />
      Continue with GitHub
    </Button>
  );
}
