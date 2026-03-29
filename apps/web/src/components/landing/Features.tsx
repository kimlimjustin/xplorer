import { Zap, Brain, Eye, Globe, GitBranch, Puzzle } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Native Performance',
    description:
      'Built with Rust and Tauri v2 for native speed. SIMD-accelerated file operations, instant directory loading, and a lightweight memory footprint.',
    color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10',
  },
  {
    icon: Brain,
    title: 'AI-Powered Search',
    description:
      'Natural language search powered by local Ollama models. Semantic file discovery, image description, and content-aware indexing -- all offline.',
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  },
  {
    icon: Eye,
    title: 'Rich Previews',
    description:
      'Preview 50+ file formats inline: images, video, audio, PDFs, Office documents, code with syntax highlighting, Markdown, CSV, and archives.',
    color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10',
  },
  {
    icon: Globe,
    title: 'SSH Remote Access',
    description:
      'Browse, upload, download, and manage files on remote servers via SSH. Full terminal integration with tab completion and command history.',
    color: 'text-green-500 bg-green-50 dark:bg-green-500/10',
  },
  {
    icon: GitBranch,
    title: 'Git Integration',
    description:
      'Built-in Git status indicators, branch management, commit history, and file diffs. See your repository state directly in the file explorer.',
    color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
  },
  {
    icon: Puzzle,
    title: 'Extensible',
    description:
      'A powerful extension SDK with themes, custom previews, sidebar panels, commands, and context menus. Build and publish your own extensions.',
    color: 'text-brand-500 bg-brand-50 dark:bg-brand-500/10',
  },
];

export function Features() {
  return (
    <section className="bg-white py-20 dark:bg-gray-950 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            Everything you need in a file manager
          </h2>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
            Powerful features designed for developers, power users, and everyone in between.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-gray-100 p-6 transition-all duration-200 hover:border-gray-200 hover:shadow-lg dark:border-gray-800 dark:hover:border-gray-700 dark:hover:shadow-gray-900/50"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
