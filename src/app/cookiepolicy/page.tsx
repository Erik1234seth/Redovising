import type { Metadata } from 'next';
import Link from 'next/link';
import CookieSettingsButton from '@/components/CookieSettingsButton';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export const metadata: Metadata = {
  title: 'Cookiepolicy | Enkla Bokslut',
  description: 'Så använder Enkla Bokslut cookies och liknande tekniker på webbplatsen.',
  alternates: { canonical: 'https://enklabokslut.se/cookiepolicy' },
};

const LAST_UPDATED = '5 juli 2026';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-xl sm:text-2xl font-extrabold mb-4" style={{ color: NAV_BG }}>{title}</h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

const cookieRows: { name: string; provider: string; purpose: string; duration: string }[] = [
  { name: 'sb-*-auth-token', provider: 'Supabase (Enkla Bokslut)', purpose: 'Håller dig inloggad och identifierar din session.', duration: 'Upp till 1 år' },
  { name: '_ga', provider: 'Google Analytics', purpose: 'Särskiljer besökare för statistik.', duration: '2 år' },
  { name: '_ga_*', provider: 'Google Analytics', purpose: 'Sparar sessionens tillstånd för statistik.', duration: '2 år' },
  { name: '_gid', provider: 'Google Analytics', purpose: 'Särskiljer besökare för statistik.', duration: '24 timmar' },
];

export default function CookiepolicyPage() {
  return (
    <div className="bg-white">

      {/* Hero */}
      <section className="px-6 py-16 sm:py-20" style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-9-9 3 3 0 003 3 3 3 0 003 3 3 3 0 003 3zM9.5 9.5h.01M14.5 14.5h.01M9 15h.01" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Cookies</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">Cookiepolicy</h1>
          <p className="text-white/60 text-base leading-relaxed">
            Här förklarar vi vilka cookies vi använder på webbplatsen, varför, och hur du själv kan
            styra dem.
          </p>
          <p className="text-white/40 text-xs mt-5">Senast uppdaterad: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16 space-y-12">

        <Section id="vad" title="1. Vad är cookies?">
          <p>
            Cookies är små textfiler som lagras på din enhet när du besöker en webbplats. De används för
            att webbplatsen ska fungera, för att komma ihåg dina val och för att förstå hur webbplatsen
            används. Vi använder även liknande tekniker, till exempel lagring i webbläsaren (local storage),
            vilka omfattas av denna policy.
          </p>
        </Section>

        <Section id="typer" title="2. Vilka cookies vi använder">
          <p>Vi delar in cookies i två kategorier:</p>
          <ul className="space-y-2.5">
            <li className="flex gap-3">
              <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL }} />
              <span>
                <strong className="text-slate-800">Nödvändiga cookies</strong> – krävs för att webbplatsen
                och tjänsten ska fungera, till exempel för att du ska kunna logga in och hålla dig inloggad.
                Dessa kan inte stängas av och kräver inte ditt samtycke.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CORAL }} />
              <span>
                <strong className="text-slate-800">Analys- och statistikcookies</strong> – hjälper oss förstå
                hur webbplatsen används så att vi kan förbättra den. Dessa sätts endast med ditt samtycke.
              </span>
            </li>
          </ul>
        </Section>

        <Section id="lista" title="3. Cookies vi använder">
          <p>Nedan följer de huvudsakliga cookies vi använder. Exakt uppsättning kan variera över tid.</p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="text-left" style={{ backgroundColor: `${NAV_BG}08`, color: NAV_BG }}>
                  <th className="py-3 px-4 font-bold">Cookie</th>
                  <th className="py-3 px-4 font-bold">Leverantör</th>
                  <th className="py-3 px-4 font-bold">Ändamål</th>
                  <th className="py-3 px-4 font-bold">Lagringstid</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {cookieRows.map((c) => (
                  <tr key={c.name} className="align-top border-t border-slate-100">
                    <td className="py-3 px-4 font-mono text-[13px] text-slate-700">{c.name}</td>
                    <td className="py-3 px-4">{c.provider}</td>
                    <td className="py-3 px-4">{c.purpose}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{c.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="samtycke" title="4. Ditt samtycke">
          <p>
            När du besöker webbplatsen första gången får du möjlighet att välja vilka icke-nödvändiga
            cookies du accepterar. Du kan när som helst{' '}
            <CookieSettingsButton /> eller återkalla ditt samtycke. Nödvändiga cookies sätts alltid
            eftersom webbplatsen inte fungerar utan dem.
          </p>
        </Section>

        <Section id="hantera" title="5. Så hanterar du cookies">
          <p>
            Utöver valen på webbplatsen kan du styra och radera cookies via inställningarna i din
            webbläsare. Du kan blockera alla cookies eller ta bort redan lagrade cookies. Tänk på att
            vissa funktioner, som inloggning, kan sluta fungera om du blockerar nödvändiga cookies.
          </p>
          <p>Instruktioner finns i hjälpavsnittet för din webbläsare, till exempel Chrome, Safari, Firefox och Edge.</p>
        </Section>

        <Section id="personuppgifter" title="6. Cookies och personuppgifter">
          <p>
            Viss information som samlas in via cookies kan utgöra personuppgifter. Hur vi behandlar
            personuppgifter beskrivs i vår{' '}
            <Link href="/integritetspolicy" className="font-medium hover:opacity-80" style={{ color: CORAL }}>
              integritetspolicy
            </Link>
            .
          </p>
        </Section>

        <Section id="andringar" title="7. Ändringar i denna policy">
          <p>
            Vi kan komma att uppdatera denna cookiepolicy. Den senaste versionen finns alltid publicerad på
            denna sida med angivet uppdateringsdatum.
          </p>
        </Section>

        {/* Contact CTA */}
        <div className="rounded-2xl p-7 sm:p-8 text-center" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}15` }}>
          <h3 className="text-lg font-extrabold mb-2" style={{ color: NAV_BG }}>Frågor om cookies?</h3>
          <p className="text-slate-500 text-sm mb-5">Hör av dig så hjälper vi dig.</p>
          <Link
            href="/kontakt"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: CORAL, boxShadow: `0 8px 20px ${CORAL}40` }}
          >
            Kontakta oss
          </Link>
        </div>

        <div className="pt-4 text-center">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← Tillbaka till startsidan
          </Link>
        </div>

      </div>
    </div>
  );
}
