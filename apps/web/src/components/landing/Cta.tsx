'use client';

import Link from 'next/link';
import { Download, Github } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

export function Cta() {
  const { ref, inView } = useInView();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-brand-50/50 to-white dark:from-gray-950 dark:via-brand-950/20 dark:to-gray-950" />
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand-500/[0.06] dark:bg-brand-500/[0.1] rounded-full blur-3xl" />
      </div>

      <div ref={ref} className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className={`reveal ${inView ? 'visible' : ''} text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white`}>
          Ready to{' '}
          <span className="animated-gradient-text bg-gradient-to-r from-brand-500 via-purple-500 to-cyan-500 dark:from-brand-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">
            explore?
          </span>
        </h2>
        <p className={`reveal ${inView ? 'visible' : ''} reveal-delay-1 mt-5 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto`}>
          Download Xplorer for free. Open source, privacy-first, and built to
          make file management fast and delightful.
        </p>

        <div className={`reveal ${inView ? 'visible' : ''} reveal-delay-2 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4`}>
          <Link
            href="/docs/getting-started/installation"
            className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 hover:-translate-y-0.5"
          >
            <Download className="h-5 w-5" />
            Download Xplorer
          </Link>
          <a
            href="https://github.com/kimlimjustin/xplorer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-all hover:-translate-y-0.5"
          >
            <Github className="h-5 w-5" />
            Star on GitHub
          </a>
        </div>

        {/* Trust indicators */}
        <div className={`reveal ${inView ? 'visible' : ''} reveal-delay-3 mt-8 flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500`}>
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
