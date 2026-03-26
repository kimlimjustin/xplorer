import type { ReactNode } from 'react';
import Link from 'next/link';

type MDXComponents = Record<string, (props: Record<string, unknown>) => ReactNode>;

function isInternalLink(href: string): boolean {
  return href.startsWith('/') || href.startsWith('#');
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    a: ({ href, children, ...props }: { href?: string; children?: ReactNode; [key: string]: unknown }) => {
      if (href && isInternalLink(href)) {
        return (
          <Link href={href} className="text-brand-600 hover:text-brand-700 underline" {...props}>
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:text-brand-700 underline"
          {...props}
        >
          {children}
        </a>
      );
    },
    pre: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <pre
        className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm"
        {...props}
      >
        {children}
      </pre>
    ),
    code: ({ children, className, ...props }: { children?: ReactNode; className?: string; [key: string]: unknown }) => {
      if (!className) {
        return (
          <code
            className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-brand-700"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    table: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full divide-y divide-gray-200 text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <th className="px-4 py-2 text-left font-semibold text-gray-900 bg-gray-50" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <td className="px-4 py-2 text-gray-600 border-t border-gray-100" {...props}>
        {children}
      </td>
    ),
    img: ({ src, alt, ...props }: { src?: string; alt?: string; [key: string]: unknown }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || ''}
        className="rounded-lg border border-gray-200 my-4 max-w-full"
        loading="lazy"
        {...props}
      />
    ),
  };
}
