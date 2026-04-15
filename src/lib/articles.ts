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

export function getAllArticleMeta(): ArticleMeta[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'));
  return files
    .map((file) => {
      const slug = file.replace('.md', '');
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8');
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
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
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
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''));
}
