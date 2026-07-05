import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'src/lib/inmail/knowledge');

let cached: string | null = null;

/**
 * Läser in alla .md/.txt-filer i knowledge-mappen och slår ihop dem till ett
 * kontextblock som kan bifogas AI:ns system-prompt. Resultatet cachas vid
 * första anropet (per serverinstans) — lägg till/ändra filer och starta om
 * dev-servern eller deploya för att det ska slå igenom.
 *
 * Fel (t.ex. saknad mapp) sväljs medvetet och ger tom sträng, så att inmatning
 * av mail aldrig kan krascha på grund av kunskapsmappen.
 */
export function loadKnowledge(): string {
  if (cached !== null) return cached;

  try {
    const files = fs
      .readdirSync(KNOWLEDGE_DIR)
      .filter((f) => /\.(md|txt)$/i.test(f) && f.toLowerCase() !== 'readme.md')
      .sort();

    const sections = files
      .map((file) => {
        const raw = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8');
        const { content, data } = matter(raw);
        const title =
          (typeof data.title === 'string' && data.title.trim()) ||
          file.replace(/\.(md|txt)$/i, '');
        const text = content.trim();
        return text ? `## ${title}\n${text}` : '';
      })
      .filter(Boolean);

    cached = sections.length
      ? `\n\nEXTRA KUNSKAP (interna dokument — använd vid behov):\n\n${sections.join('\n\n')}`
      : '';
  } catch (err) {
    console.error('[inmail] Kunde inte ladda kunskapsmappen:', err);
    cached = '';
  }

  return cached;
}
