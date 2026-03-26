'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConnectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to billing page which handles Connect setup
    router.replace('/billing');
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-gray-600 dark:text-gray-400">Redirecting to billing...</p>
    </div>
  );
}
