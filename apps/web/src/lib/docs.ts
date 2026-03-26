import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const DOCS_DIR = path.join(process.cwd(), 'content', 'docs');

export interface DocMeta {
  slug: string;
  title: string;
  sidebarPosition?: number;
  description?: string;
}

export function getDocBySlug(slugParts: string[]): { meta: DocMeta; content: string } | null {
  // Validate no path traversal
  if (slugParts.some(part => part === '..' || part === '.' || part.includes('/'))) return null;

  const filePath = path.join(DOCS_DIR, ...slugParts) + '.mdx';
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    meta: {
      slug: slugParts.join('/'),
      title: data.title || slugParts[slugParts.length - 1],
      sidebarPosition: data.sidebar_position,
      description: data.description,
    },
    content,
  };
}

export function getAllDocSlugs(): string[][] {
  const slugs: string[][] = [];
  function walk(dir: string, prefix: string[] = []) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.name.endsWith('.mdx')) {
        const name = entry.name.replace(/\.mdx$/, '');
        slugs.push([...prefix, name]);
      }
    }
  }
  walk(DOCS_DIR);
  return slugs;
}

// Re-export sidebar data (client-safe, no fs/path)
export { DOCS_SIDEBAR } from './docs-sidebar';
export type { SidebarItem, SidebarCategory, SidebarEntry } from './docs-sidebar';
