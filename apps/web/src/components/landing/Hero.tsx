'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, Github } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const FileBrowserDemo = dynamic(() => import('./FeatureDemos').then((m) => m.FileBrowserDemo), {
  ssr: false,
});

export function Hero() {
  const { ref, inView } = useInView();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-gray-100/50 dark:from-[#0a0a1a] dark:via-[#0d0d24] dark:to-gray-950">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-500/[0.07] to-transparent blur-3xl dark:from-brand-500/[0.12]" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-500/[0.04] blur-3xl dark:bg-purple-500/[0.08]" />
        <div className="absolute left-0 top-1/3 h-[400px] w-[400px] rounded-full bg-cyan-500/[0.04] blur-3xl dark:bg-cyan-500/[0.06]" />
        {/* Floating orbs */}
        <div className="animate-float absolute left-[12%] top-[15%] h-3 w-3 rounded-full bg-brand-400/30 dark:bg-brand-400/20" />
        <div className="animate-float-delayed absolute right-[18%] top-[25%] h-2 w-2 rounded-full bg-purple-400/25 dark:bg-purple-400/15" />
        <div className="animate-float-slow absolute left-[8%] top-[45%] h-2.5 w-2.5 rounded-full bg-cyan-400/20 dark:bg-cyan-400/15" />
        <div className="animate-float absolute right-[10%] top-[60%] h-2 w-2 rounded-full bg-brand-300/20 dark:bg-brand-300/10" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div
        ref={ref}
        className="relative mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 sm:pt-32 lg:px-8 lg:pt-40"
      >
        {/* Badge */}
        <div className={`reveal ${inView ? 'visible' : ''} mb-8 flex justify-center`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
            </span>
            Now in Beta — Built with Rust & Tauri v2
          </div>
        </div>

        {/* Headline */}
        <h1
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-1 text-center text-5xl font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-white sm:text-6xl lg:text-7xl`}
        >
          The file manager <br className="hidden sm:block" />
          <span className="animated-gradient-text bg-gradient-to-r from-brand-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent dark:from-brand-400 dark:via-purple-400 dark:to-cyan-400">
            you deserve.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-2 mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-gray-500 dark:text-gray-400 sm:text-xl`}
        >
          AI-powered search, rich previews for 50+ formats, Git integration, SSH remote access, and
          an extension ecosystem — all at native speed.
        </p>

        {/* CTA Buttons */}
        <div
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row`}
        >
          <Link
            href="/docs/getting-started/installation"
            className="pulse-glow group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-brand-600/40"
          >
            Download for Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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

        {/* Real App Window — uses the actual Xplorer components */}
        <div className={`reveal ${inView ? 'visible' : ''} reveal-delay-4 mt-16 sm:mt-20 lg:mt-24`}>
          <div className="mx-auto max-w-6xl">
            <div className="window-glow gradient-border overflow-hidden rounded-xl bg-gray-900 dark:bg-gray-900">
              {/* Real component composition — TopBar acts as the title bar */}
              <div className="relative aspect-[16/10] min-h-[520px]">
                <FileBrowserDemo />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="h-24 bg-gradient-to-b from-transparent to-white dark:to-gray-950" />
    </section>
  );
}
