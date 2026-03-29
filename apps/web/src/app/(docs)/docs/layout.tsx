import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <DocsSidebar />
          </div>
        </aside>

        {/* Content */}
        <article className="prose-brand prose prose-gray min-w-0 max-w-none flex-1 dark:prose-invert">
          {children}
        </article>
      </div>
    </div>
  );
}
