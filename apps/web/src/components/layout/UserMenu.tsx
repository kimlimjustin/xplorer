'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  CreditCard,
  Shield,
  LogOut,
  ChevronDown,
} from 'lucide-react';

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!session?.user) return null;

  const user = session.user;
  const isAdmin = user.role === 'admin';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name || 'User'}
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 flex items-center justify-center text-sm font-medium">
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
        )}
        <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
          {user.name}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>

          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/billing"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <CreditCard className="h-4 w-4" />
            Billing
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
