import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <DocsSidebar />
          </div>
        </aside>

        {/* Content */}
        <article className="min-w-0 flex-1 prose prose-gray dark:prose-invert prose-brand max-w-none">
          {children}
        </article>
      </div>
    </div>
  );
}
