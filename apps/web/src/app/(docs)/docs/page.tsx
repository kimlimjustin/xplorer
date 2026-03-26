import { MDXRemote } from 'next-mdx-remote/rsc';
import { getDocBySlug } from '@/lib/docs';
import { useMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: `Documentation | ${SITE_NAME}`,
  description: 'Xplorer documentation - learn how to install, configure, and extend Xplorer.',
};

export default function DocsIndexPage() {
  const doc = getDocBySlug(['intro']);

  if (!doc) {
    return (
      <div>
        <h1>Welcome to Xplorer Docs</h1>
        <p>Documentation is coming soon.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{doc.meta.title}</h1>
      {doc.meta.description && (
        <p className="text-lg text-gray-500 mb-8">{doc.meta.description}</p>
      )}
      <MDXRemote source={doc.content} components={useMDXComponents({})} />
    </div>
  );
}
