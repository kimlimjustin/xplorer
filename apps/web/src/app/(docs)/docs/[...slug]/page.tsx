import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getDocBySlug, getAllDocSlugs } from '@/lib/docs';
import { useMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/constants';

interface DocPageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return { title: 'Not Found' };

  return {
    title: `${doc.meta.title} | ${SITE_NAME}`,
    description: doc.meta.description,
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{doc.meta.title}</h1>
      {doc.meta.description && (
        <p className="text-lg text-gray-500 mb-8">{doc.meta.description}</p>
      )}
      <MDXRemote source={doc.content} components={useMDXComponents({})} />
    </div>
  );
}
