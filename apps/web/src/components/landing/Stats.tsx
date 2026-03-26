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
  { value: '50+', label: 'File Formats', description: 'Previewed natively', icon: FileStack, accent: 'bg-brand-500' },
  { value: '<50MB', label: 'Install Size', description: 'Lightweight and fast', icon: HardDrive, accent: 'bg-green-500' },
  { value: 'SSH', label: 'Remote Access', description: 'Full server browsing', icon: Globe, accent: 'bg-cyan-500' },
  { value: '100%', label: 'Offline AI', description: 'Local Ollama models', icon: Brain, accent: 'bg-purple-500' },
];

export function Stats() {
  const { ref, inView } = useInView();

  return (
    <section className="relative py-20 sm:py-28 bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-500/[0.02] via-transparent to-purple-500/[0.02] dark:from-brand-500/[0.04] dark:to-purple-500/[0.04]" />

      <div ref={ref} className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`reveal ${inView ? 'visible' : ''} reveal-delay-${i + 1} glass-card rounded-xl p-6 text-center relative overflow-hidden`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${stat.accent}`} />
              <stat.icon className="h-6 w-6 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
              <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-brand-600 to-purple-600 dark:from-brand-400 dark:to-purple-400 bg-clip-text text-transparent">
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
