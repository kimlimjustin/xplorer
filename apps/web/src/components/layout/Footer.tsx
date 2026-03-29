'use client';

import { useState, useRef } from 'react';
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

const NewsletterForm = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const renderTimeRef = useRef(Date.now());

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    try {
      const form = e.currentTarget;
      const honeypot = (form.elements.namedItem('website') as HTMLInputElement)?.value;

      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email: email.trim(), website: honeypot, _t: renderTimeRef.current }),
      });

      if (res.ok) {
        setStatus('success');
        setMessage('Subscribed!');
        setEmail('');
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setMessage(data.error || 'Failed to subscribe');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Try again.');
    }
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
        Stay updated
      </h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Get release notes and tips in your inbox.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus('idle');
          }}
          placeholder="you@example.com"
          required
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        {/* Honeypot — hidden from humans, filled by bots */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px' }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : 'Subscribe'}
        </button>
      </form>
      {status === 'success' && <p className="mt-2 text-xs text-green-500">{message}</p>}
      {status === 'error' && <p className="mt-2 text-xs text-red-500">{message}</p>}
    </div>
  );
};

export function Footer() {
  return (
    <footer className="relative bg-gray-50 dark:bg-gray-900">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Xplorer" className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              A modern, AI-powered file explorer built with Rust and React.
            </p>
            {/* Social icons */}
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://github.com/kimlimjustin/xplorer"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com/xplorer_app"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

        {/* Newsletter */}
        <div className="mt-8 border-t border-gray-200 pt-8 dark:border-gray-800">
          <div className="max-w-md">
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-gray-200 pt-8 text-sm text-gray-400 dark:border-gray-800 dark:text-gray-500 sm:flex-row">
          <span>
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </span>
          <span>Built with Rust</span>
        </div>
      </div>
    </footer>
  );
}
