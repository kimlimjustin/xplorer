'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { FolderOpen, Eye, Brain, Search, GitBranch, Puzzle, type LucideIcon } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

// All demos are dynamic (ssr: false) because FeatureDemos imports @client/ components
const FileBrowserDemo = dynamic(() => import('./FeatureDemos').then((m) => m.FileBrowserDemo), {
  ssr: false,
});
const PreviewDemo = dynamic(() => import('./FeatureDemos').then((m) => m.PreviewDemo), {
  ssr: false,
});
const AIChatDemo = dynamic(() => import('./FeatureDemos').then((m) => m.AIChatDemo), {
  ssr: false,
});
const SearchDemo = dynamic(() => import('./FeatureDemos').then((m) => m.SearchDemo), {
  ssr: false,
});
const GitDemo = dynamic(() => import('./FeatureDemos').then((m) => m.GitDemo), { ssr: false });
const ExtensionsDemo = dynamic(() => import('./FeatureDemos').then((m) => m.ExtensionsDemo), {
  ssr: false,
});

interface Feature {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  iconBg: string;
  demo: React.ComponentType<{ compact?: boolean }>;
}

const FEATURES: Feature[] = [
  {
    icon: FolderOpen,
    label: 'File Browsing',
    title: 'Navigate at the speed of thought.',
    description:
      'Grid, list, and column views with instant directory switching. Multi-selection, drag-and-drop, tabbed browsing, and an address bar that keeps up with you.',
    iconBg: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400',
    demo: (props) => <FileBrowserDemo compact {...props} />,
  },
  {
    icon: Eye,
    label: 'Rich Previews',
    title: 'Preview anything. Instantly.',
    description:
      'Images, PDFs, code with syntax highlighting, Office documents, video, audio, Markdown, CSV, archives — over 50 formats rendered inline without opening another app.',
    iconBg: 'bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400',
    demo: PreviewDemo,
  },
  {
    icon: Brain,
    label: 'AI Chat',
    title: 'Ask your files anything.',
    description:
      'Chat with local AI models about your files. Get organization suggestions, content summaries, and smart categorization — all running privately on your machine via Ollama.',
    iconBg: 'bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400',
    demo: AIChatDemo,
  },
  {
    icon: Search,
    label: 'Smart Search',
    title: 'Search by meaning, not just name.',
    description:
      'Natural language queries with content indexing and semantic search. "Large images from last month" or "PDF invoices over 1MB" — it just works.',
    iconBg: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
    demo: SearchDemo,
  },
  {
    icon: GitBranch,
    label: 'GitLens',
    title: 'Your repo, at a glance.',
    description:
      'Commit graph, branch management, blame view, and file diffs — built right into the file explorer. See modified, staged, and untracked files without leaving the window.',
    iconBg: 'bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400',
    demo: GitDemo,
  },
  {
    icon: Puzzle,
    label: 'Extensions',
    title: 'Make it yours.',
    description:
      'Themes, custom previews, sidebar panels, commands, and context menus. A powerful SDK with a growing marketplace. Build and share your own plugins.',
    iconBg: 'bg-brand-500/10 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400',
    demo: ExtensionsDemo,
  },
];

function FeatureSection({
  feature,
  reversed,
  index,
}: {
  feature: Feature;
  reversed: boolean;
  index: number;
}) {
  const { ref, inView } = useInView();
  const step = String(index + 1).padStart(2, '0');

  return (
    <div ref={ref} className={cn('grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20')}>
      {/* Text side */}
      <div className={cn(reversed && 'lg:order-2')}>
        <div className={`reveal ${inView ? 'visible' : ''}`}>
          <span className="mb-3 block select-none text-5xl font-black text-gray-100 dark:text-gray-800/60 sm:text-6xl">
            {step}
          </span>
          <div className="mb-4 inline-flex items-center gap-2 border-l-2 border-brand-500 pl-3 dark:border-brand-400">
            <div
              className={cn('flex h-8 w-8 items-center justify-center rounded-lg', feature.iconBg)}
            >
              <feature.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {feature.label}
            </span>
          </div>
        </div>
        <h3
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-1 text-3xl font-bold leading-tight text-gray-900 dark:text-white sm:text-4xl`}
        >
          {feature.title}
        </h3>
        <p
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-2 mt-4 text-lg leading-relaxed text-gray-500 dark:text-gray-400`}
        >
          {feature.description}
        </p>
      </div>

      {/* Visual side */}
      <div className={cn(reversed && 'lg:order-1')}>
        <div className={`reveal ${inView ? 'visible' : ''} reveal-delay-2`}>
          <div
            className="window-glow relative overflow-hidden rounded-xl ring-1 ring-white/[0.08]"
            style={{
              background:
                'linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 25%, #1a0a2e 50%, #0a1a2e 75%, #0a0a1a 100%)',
            }}
          >
            {/* macOS-style title bar */}
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#111122]/80 px-3 py-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] font-medium text-white/40">Xplorer</span>
            </div>
            {/* Interactive demo */}
            <div className="relative aspect-[16/10]">
              <feature.demo />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeatureShowcase() {
  const { ref: headerRef, inView: headerVisible } = useInView();

  return (
    <section className="bg-white py-24 dark:bg-gray-950 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div ref={headerRef} className="mx-auto mb-20 max-w-3xl text-center sm:mb-28">
          <p
            className={`reveal ${headerVisible ? 'visible' : ''} mb-3 text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400`}
          >
            Features
          </p>
          <h2
            className={`reveal ${headerVisible ? 'visible' : ''} reveal-delay-1 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl`}
          >
            Everything you need.
            <br />
            Nothing you don&apos;t.
          </h2>
          <p
            className={`reveal ${headerVisible ? 'visible' : ''} reveal-delay-2 mt-5 text-lg text-gray-500 dark:text-gray-400`}
          >
            Powerful features designed for developers and power users, wrapped in a clean interface
            that stays out of your way.
          </p>
        </div>

        {/* Feature sections */}
        <div className="space-y-24 sm:space-y-32 lg:space-y-40">
          {FEATURES.map((feature, i) => (
            <FeatureSection
              key={feature.label}
              feature={feature}
              reversed={i % 2 !== 0}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
