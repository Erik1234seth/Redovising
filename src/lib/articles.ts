import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'artiklar');

export interface ArticleMeta {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  category?: string;
}

export interface Article extends ArticleMeta {
  content: string; // rendered HTML
}

/** Recursively collect all .md file paths under a directory */
function collectMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

export function getAllArticleMeta(): ArticleMeta[] {
  return collectMdFiles(ARTICLES_DIR)
    .map((filePath) => {
      const slug = path.basename(filePath, '.md');
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(raw);
      return {
        slug,
        title: data.title ?? slug,
        description: data.description ?? '',
        publishedAt: data.publishedAt ?? '',
        updatedAt: data.updatedAt,
        category: data.category,
      };
    })
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getArticle(slug: string): Article | null {
  const all = collectMdFiles(ARTICLES_DIR);
  const filePath = all.find((f) => path.basename(f, '.md') === slug);
  if (!filePath) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const html = marked(content) as string;
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    publishedAt: data.publishedAt ?? '',
    updatedAt: data.updatedAt,
    category: data.category,
    content: html,
  };
}

export function getAllSlugs(): string[] {
  return collectMdFiles(ARTICLES_DIR).map((f) => path.basename(f, '.md'));
}
