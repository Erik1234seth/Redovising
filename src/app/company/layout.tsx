import type { Metadata } from 'next';

/**
 * company.enklabokslut.se har ett eget skal: ingen kundnavigering, ingen
 * sidfot, ingen nedräkning och ingen popup. Rotlayouten döljer de delarna
 * när middleware satt x-is-company, på samma sätt som för adminpanelen, och
 * sätter lang="en" — sidan är på engelska, resten av sajten på svenska.
 *
 * Sidan är medvetet noindex. Länken delas aktivt på LinkedIn — den ska inte
 * dyka upp när en kund googlar på varumärket.
 */

const titel = 'Sethapp — building scalable accounting for small businesses';
const beskrivning =
  'Sethapp develops technology-enabled financial services designed to make accounting simpler, more efficient and more scalable. Our first service is Enkla Bokslut.';

export const metadata: Metadata = {
  title: titel,
  description: beskrivning,
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://company.enklabokslut.se' },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://company.enklabokslut.se',
    siteName: 'Sethapp',
    title: titel,
    description: beskrivning,
  },
  twitter: {
    card: 'summary_large_image',
    title: titel,
    description: beskrivning,
  },
};

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-white text-navy-900 antialiased">{children}</div>;
}
