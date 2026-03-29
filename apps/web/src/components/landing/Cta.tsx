'use client';

import Link from 'next/link';
import { Download, Github } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

export function Cta() {
  const { ref, inView } = useInView();

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-brand-50/50 to-white dark:from-gray-950 dark:via-brand-950/20 dark:to-gray-950" />
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/[0.06] blur-3xl dark:bg-brand-500/[0.1]" />
      </div>

      <div ref={ref} className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2
          className={`reveal ${inView ? 'visible' : ''} text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl`}
        >
          Ready to{' '}
          <span className="animated-gradient-text bg-gradient-to-r from-brand-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent dark:from-brand-400 dark:via-purple-400 dark:to-cyan-400">
            explore?
          </span>
        </h2>
        <p
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-1 mx-auto mt-5 max-w-xl text-lg text-gray-500 dark:text-gray-400`}
        >
          Download Xplorer for free. Open source, privacy-first, and built to make file management
          fast and delightful.
        </p>

        <div
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-2 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row`}
        >
          <Link
            href="/docs/getting-started/installation"
            className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-brand-600/40"
          >
            <Download className="h-5 w-5" />
            Download Xplorer
          </Link>
          <a
            href="https://github.com/kimlimjustin/xplorer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-8 py-3.5 font-semibold text-gray-700 transition-all hover:-translate-y-0.5 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <Github className="h-5 w-5" />
            Star on GitHub
          </a>
        </div>

        {/* Trust indicators */}
        <div
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-3 mt-8 flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500`}
        >
          <span>Open Source</span>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span>Privacy First</span>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span>Free Forever</span>
        </div>
      </div>
    </section>
  );
}
