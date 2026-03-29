'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/Button';

const NAV_LINKS = [
  { href: '/docs', label: 'Docs' },
  { href: '/extensions', label: 'Extensions' },
  { href: '/pricing', label: 'Pricing' },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 backdrop-blur-md transition-all duration-300',
        scrolled
          ? 'border-b border-gray-200/80 bg-white/80 shadow-sm dark:border-gray-800/80 dark:bg-gray-950/80'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo.svg" alt="Xplorer" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">Xplorer</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            {status === 'loading' ? (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ) : session?.user ? (
              <>
                <Link href="/publish">
                  <Button variant="secondary" size="sm">
                    Publish
                  </Button>
                </Link>
                <UserMenu />
              </>
            ) : (
              <Link href="/auth/signin">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="space-y-1 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950 md:hidden">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="px-3 py-1">
              <ThemeToggle />
            </div>
            {session?.user ? (
              <>
                <Link
                  href="/publish"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Publish Extension
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <Link href="/auth/signin" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
