'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, Github } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const FileBrowserDemo = dynamic(
  () => import('./FeatureDemos').then(m => m.FileBrowserDemo),
  { ssr: false },
);

export function Hero() {
  const { ref, inView } = useInView();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-gray-100/50 dark:from-[#0a0a1a] dark:via-[#0d0d24] dark:to-gray-950">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-brand-500/[0.07] to-transparent dark:from-brand-500/[0.12] rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-purple-500/[0.04] dark:bg-purple-500/[0.08] rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-cyan-500/[0.04] dark:bg-cyan-500/[0.06] rounded-full blur-3xl" />
        {/* Floating orbs */}
        <div className="absolute top-[15%] left-[12%] w-3 h-3 rounded-full bg-brand-400/30 dark:bg-brand-400/20 animate-float" />
        <div className="absolute top-[25%] right-[18%] w-2 h-2 rounded-full bg-purple-400/25 dark:bg-purple-400/15 animate-float-delayed" />
        <div className="absolute top-[45%] left-[8%] w-2.5 h-2.5 rounded-full bg-cyan-400/20 dark:bg-cyan-400/15 animate-float-slow" />
        <div className="absolute top-[60%] right-[10%] w-2 h-2 rounded-full bg-brand-300/20 dark:bg-brand-300/10 animate-float" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div ref={ref} className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 lg:pt-40 pb-8">
        {/* Badge */}
        <div className={`reveal ${inView ? 'visible' : ''} flex justify-center mb-8`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-600" />
            </span>
            Now in Beta — Built with Rust & Tauri v2
          </div>
        </div>

        {/* Headline */}
        <h1 className={`reveal ${inView ? 'visible' : ''} reveal-delay-1 text-center text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white leading-[1.1]`}>
          The file manager{' '}
          <br className="hidden sm:block" />
          <span className="animated-gradient-text bg-gradient-to-r from-brand-500 via-purple-500 to-cyan-500 dark:from-brand-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">
            you deserve.
          </span>
        </h1>

        {/* Subtitle */}
        <p className={`reveal ${inView ? 'visible' : ''} reveal-delay-2 mt-6 text-center text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed`}>
          AI-powered search, rich previews for 50+ formats, Git integration,
          SSH remote access, and an extension ecosystem — all at native speed.
        </p>

        {/* CTA Buttons */}
        <div className={`reveal ${inView ? 'visible' : ''} reveal-delay-3 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4`}>
          <Link
            href="/docs/getting-started/installation"
            className="pulse-glow group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 hover:-translate-y-0.5"
          >
            Download for Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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

        {/* Real App Window — uses the actual Xplorer components */}
        <div className={`reveal ${inView ? 'visible' : ''} reveal-delay-4 mt-16 sm:mt-20 lg:mt-24`}>
          <div className="mx-auto max-w-6xl">
            <div className="window-glow gradient-border rounded-xl overflow-hidden bg-gray-900 dark:bg-gray-900">
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
