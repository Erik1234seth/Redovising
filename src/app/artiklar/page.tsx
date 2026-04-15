import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllArticleMeta } from '@/lib/articles';

export const metadata: Metadata = {
  title: 'Artiklar & guider – Enkla Bokslut',
  description: 'Guider och råd om bokslut, NE-bilaga och deklaration för enskild firma. Lär dig mer om hur du sköter din redovisning på rätt sätt.',
  alternates: { canonical: 'https://enklabokslut.se/artiklar' },
  openGraph: {
    title: 'Artiklar & guider – Enkla Bokslut',
    description: 'Guider och råd om bokslut, NE-bilaga och deklaration för enskild firma.',
    url: 'https://enklabokslut.se/artiklar',
    siteName: 'Enkla Bokslut',
    locale: 'sv_SE',
    type: 'website',
  },
};

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

export default function ArtiklarPage() {
  const articles = getAllArticleMeta();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="py-20 sm:py-24" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
            Guider & råd
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Artiklar om bokslut & deklaration
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Allt du behöver veta som enskild firma – förklarat på ett enkelt sätt.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {articles.length === 0 ? (
            <p className="text-slate-400 text-center">Inga artiklar publicerade ännu.</p>
          ) : (
            <div className="space-y-6">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/artiklar/${article.slug}`}
                  className="group block rounded-2xl border border-gray-100 p-7 hover:border-gray-200 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {article.category && (
                        <span
                          className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3"
                          style={{ backgroundColor: `${CORAL}12`, color: CORAL }}
                        >
                          {article.category}
                        </span>
                      )}
                      <h2
                        className="text-xl font-bold mb-2 group-hover:underline underline-offset-2"
                        style={{ color: NAV_BG }}
                      >
                        {article.title}
                      </h2>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        {article.description}
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  {article.publishedAt && (
                    <p className="text-xs text-slate-400 mt-4">
                      {new Date(article.publishedAt).toLocaleDateString('sv-SE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* CTA */}
          <div
            className="mt-14 rounded-2xl p-8 text-center"
            style={{ backgroundColor: NAV_BG }}
          >
            <h3 className="text-xl font-extrabold text-white mb-2">Redo att lämna det till oss?</h3>
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
        </div>
      </section>
    </div>
  );
}
