'use client';

import Link from 'next/link';
import { Github, Twitter } from 'lucide-react';
import { SITE_NAME } from '@/lib/constants';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Extensions', href: '/extensions' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Publish', href: '/publish' },
      { label: 'SDK Reference', href: '/docs/extensions/sdk' },
      { label: 'API', href: '/docs/api/tauri-commands' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'GitHub', href: 'https://github.com/kimlimjustin/xplorer' },
      { label: 'Twitter', href: 'https://twitter.com/xplorer_app' },
      { label: 'Donate', href: '/donate' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative bg-gray-50 dark:bg-gray-900">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Xplorer" className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {SITE_NAME}
              </span>
            </Link>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              A modern, AI-powered file explorer built with Rust and React.
            </p>
            {/* Social icons */}
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://github.com/kimlimjustin/xplorer"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com/xplorer_app"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      {...(link.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-400 dark:text-gray-500">
          <span>&copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</span>
          <span>Built with Rust</span>
        </div>
      </div>
    </footer>
  );
}
