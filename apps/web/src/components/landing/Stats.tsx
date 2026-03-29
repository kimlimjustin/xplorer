'use client';

import { FileStack, HardDrive, Globe, Brain, type LucideIcon } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

interface Stat {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

const STATS: Stat[] = [
  {
    value: '50+',
    label: 'File Formats',
    description: 'Previewed natively',
    icon: FileStack,
    accent: 'bg-brand-500',
  },
  {
    value: '<50MB',
    label: 'Install Size',
    description: 'Lightweight and fast',
    icon: HardDrive,
    accent: 'bg-green-500',
  },
  {
    value: 'SSH',
    label: 'Remote Access',
    description: 'Full server browsing',
    icon: Globe,
    accent: 'bg-cyan-500',
  },
  {
    value: '100%',
    label: 'Offline AI',
    description: 'Local Ollama models',
    icon: Brain,
    accent: 'bg-purple-500',
  },
];

export function Stats() {
  const { ref, inView } = useInView();

  return (
    <section className="relative overflow-hidden bg-gray-50 py-20 dark:bg-gray-900/50 sm:py-28">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-500/[0.02] via-transparent to-purple-500/[0.02] dark:from-brand-500/[0.04] dark:to-purple-500/[0.04]" />

      <div ref={ref} className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`reveal ${inView ? 'visible' : ''} reveal-delay-${i + 1} glass-card relative overflow-hidden rounded-xl p-6 text-center`}
            >
              <div className={`absolute left-0 right-0 top-0 h-1 ${stat.accent}`} />
              <stat.icon className="mx-auto mb-3 h-6 w-6 text-gray-400 dark:text-gray-500" />
              <div className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent dark:from-brand-400 dark:to-purple-400 sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                {stat.label}
              </div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
