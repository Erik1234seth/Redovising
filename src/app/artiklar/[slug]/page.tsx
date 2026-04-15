import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getArticle, getAllSlugs } from '@/lib/articles';

const SITE_URL = 'https://enklabokslut.se';
const NAV_BG = '#173b57';
const CORAL = '#E95C63';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  const url = `${SITE_URL}/artiklar/${slug}`;

  return {
    title: `${article.title} – Enkla Bokslut`,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      siteName: 'Enkla Bokslut',
      locale: 'sv_SE',
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
    },
  };
}

export default async function ArtikelPage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const url = `${SITE_URL}/artiklar/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: {
      '@type': 'Organization',
      name: 'Enkla Bokslut',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Enkla Bokslut',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logga.png`,
      },
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hem', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Artiklar', item: `${SITE_URL}/artiklar` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="py-12 sm:py-16" style={{ backgroundColor: NAV_BG }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <Link href="/" className="hover:text-white transition-colors">Hem</Link>
              <span>/</span>
              <Link href="/artiklar" className="hover:text-white transition-colors">Artiklar</Link>
              <span>/</span>
              <span className="text-white/70 truncate">{article.title}</span>
            </nav>

            {article.category && (
              <span
                className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full mb-4"
                style={{ backgroundColor: `${CORAL}25`, color: CORAL }}
              >
                {article.category}
              </span>
            )}

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              {article.title}
            </h1>

            <p className="text-white/60 text-lg leading-relaxed mb-6">
              {article.description}
            </p>

            {article.publishedAt && (
              <p className="text-white/35 text-sm">
                Publicerad{' '}
                {new Date(article.publishedAt).toLocaleDateString('sv-SE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {article.updatedAt && article.updatedAt !== article.publishedAt && (
                  <> · Uppdaterad{' '}
                    {new Date(article.updatedAt).toLocaleDateString('sv-SE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <article
            className="prose prose-lg prose-slate max-w-none
              prose-headings:font-extrabold
              prose-h1:text-3xl
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8
              prose-a:text-[#E95C63] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-slate-800
              prose-li:text-slate-600
              prose-p:text-slate-600 prose-p:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* CTA */}
          <div
            className="mt-14 rounded-2xl p-8 text-center"
            style={{ backgroundColor: NAV_BG }}
          >
            <h3 className="text-xl font-extrabold text-white mb-2">Vill du ha hjälp med din NE-bilaga?</h3>
            <p className="text-white/55 text-sm mb-6 max-w-xs mx-auto">
              Vi sköter bokslut och NE-bilaga åt dig – fast pris, snabb leverans.
            </p>
            <Link
              href="/#packages"
              className="inline-flex items-center gap-2 px-7 py-3 font-bold rounded-xl text-sm transition-all hover:scale-[1.02]"
              style={{ backgroundColor: CORAL, color: 'white' }}
            >
              Se våra paket →
            </Link>
          </div>

          {/* Back */}
          <div className="mt-8 text-center">
            <Link href="/artiklar" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">
              ← Tillbaka till alla artiklar
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
