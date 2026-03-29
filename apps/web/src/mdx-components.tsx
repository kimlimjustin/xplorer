import type { ReactNode } from 'react';
import Link from 'next/link';

type MDXComponents = Record<string, (props: Record<string, unknown>) => ReactNode>;

function isInternalLink(href: string): boolean {
  return href.startsWith('/') || href.startsWith('#');
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    a: ({
      href,
      children,
      ...props
    }: {
      href?: string;
      children?: ReactNode;
      [key: string]: unknown;
    }) => {
      if (href && isInternalLink(href)) {
        return (
          <Link href={href} className="text-brand-600 underline hover:text-brand-700" {...props}>
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 underline hover:text-brand-700"
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
    code: ({
      children,
      className,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => {
      if (!className) {
        return (
          <code
            className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-brand-700"
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
      <div className="my-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <th className="bg-gray-50 px-4 py-2 text-left font-semibold text-gray-900" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <td className="border-t border-gray-100 px-4 py-2 text-gray-600" {...props}>
        {children}
      </td>
    ),
    img: ({ src, alt, ...props }: { src?: string; alt?: string; [key: string]: unknown }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || ''}
        className="my-4 max-w-full rounded-lg border border-gray-200"
        loading="lazy"
        {...props}
      />
    ),
  };
}
