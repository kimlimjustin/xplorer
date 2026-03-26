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
    <section className="py-12 sm:py-16 bg-white dark:bg-gray-950 border-y border-gray-100 dark:border-gray-800/50">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className={`reveal ${inView ? 'visible' : ''} text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-8`}>
          Built with
        </p>
        <div className={`reveal ${inView ? 'visible' : ''} reveal-delay-1 flex flex-wrap items-center justify-center gap-4 sm:gap-6`}>
          {TECH.map((t) => (
            <div
              key={t.name}
              className={`glass-card flex items-center gap-3 px-5 py-3 rounded-xl border-b-2 ${t.accent}`}
            >
              <t.icon className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />
              <div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {t.name}
                </span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  {t.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
