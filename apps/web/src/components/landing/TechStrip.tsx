'use client';

import { Cpu, Layers, Blocks, FileCode, Brain, type LucideIcon } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

interface Tech {
  name: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
}

const TECH: Tech[] = [
  { name: 'Rust', desc: 'Backend', icon: Cpu, accent: 'border-orange-500/40' },
  { name: 'Tauri v2', desc: 'Framework', icon: Layers, accent: 'border-brand-500/40' },
  { name: 'React', desc: 'Frontend', icon: Blocks, accent: 'border-cyan-500/40' },
  { name: 'TypeScript', desc: 'Language', icon: FileCode, accent: 'border-blue-500/40' },
  { name: 'Ollama', desc: 'AI Engine', icon: Brain, accent: 'border-purple-500/40' },
];

export function TechStrip() {
  const { ref, inView } = useInView();

  return (
    <section className="border-y border-gray-100 bg-white py-12 dark:border-gray-800/50 dark:bg-gray-950 sm:py-16">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p
          className={`reveal ${inView ? 'visible' : ''} mb-8 text-center text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500`}
        >
          Built with
        </p>
        <div
          className={`reveal ${inView ? 'visible' : ''} reveal-delay-1 flex flex-wrap items-center justify-center gap-4 sm:gap-6`}
        >
          {TECH.map((t) => (
            <div
              key={t.name}
              className={`glass-card flex items-center gap-3 rounded-xl border-b-2 px-5 py-3 ${t.accent}`}
            >
              <t.icon className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
              <div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{t.name}</span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">{t.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
