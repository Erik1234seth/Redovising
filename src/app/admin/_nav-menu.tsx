'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Arende, FlodeKund, InkorgKonversation } from '@/lib/admin-types';

/**
 * Huvudsidorna, som vanliga länkar i menyraden. Ringlista, Kalender,
 * Flödesschema och Testflöde ligger i dropdownen Mer (sedan 2026-11-25).
 *
 * SMS-utkast, Underlag, Möten och Systemstatus togs bort härifrån 2026-10-10.
 * Sidorna finns kvar på sina adresser tills Inkorgen, Ärenden och Översikten
 * tar över det de gör.
 *
 * Siffran i hörnet räknas som på översikten, från samma routes som sidorna:
 * - Inkorg: olästa konversationer
 * - Ärenden: öppna ärenden för idag och försenade
 * - Kalender: det som står i kalendern idag, med möten
 * - Flöde: kunder med nya underlag att köra
 * Röd när något är försenat. En siffra som inte gick att hämta visas inte alls.
 */

const ITEMS: { href: string; label: string }[] = [
  { href: '/admin/flode', label: 'Flöde' },
  { href: '/admin/inkorg', label: 'Inkorg' },
  { href: '/admin/arenden', label: 'Ärenden' },
  { href: '/admin/kontoplan/lopande', label: 'Löpande bokföring' },
  { href: '/admin/kontoplan/bokslut', label: 'Bokslut' },
];

/** Under Mer. */
const MER: { href: string; label: string }[] = [
  { href: '/admin/ringlista', label: 'Ringlista' },
  { href: '/admin/kalender', label: 'Kalender' },
  { href: '/admin/flodesschema', label: 'Flödesschema' },
  { href: '/admin/testflode', label: 'Testflöde' },
];

const arAktiv = (pathname: string | null, href: string) => pathname === href || !!pathname?.startsWith(`${href}/`);

function Siffra({ r }: { r: { antal: number; bradskande: boolean } | null | undefined }) {
  if (!r || r.antal <= 0) return null;
  return (
    <span
      className={`absolute -top-2 -right-3.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-[18px] text-center text-white tabular-nums ${
        r.bradskande ? 'bg-red-600' : 'bg-blue-600'
      }`}
    >
      {r.antal > 99 ? '99+' : r.antal}
    </span>
  );
}

const POLL_MS = 60_000;

/** Skickas med `window.dispatchEvent(new Event(RAKNA_OM))` när siffrorna ska räknas om direkt. */
export const RAKNA_OM = 'admin:rakna-om';

type Raknare = Record<string, { antal: number; bradskande: boolean } | null>;

const hamta = <T,>(url: string, valj: (d: Record<string, unknown>) => T): Promise<T | null> =>
  fetch(url).then((r) => r.json()).then((d) => (d.error ? null : valj(d))).catch(() => null);

async function raknaAlla(): Promise<Raknare> {
  const idag = new Date().toLocaleDateString('sv-SE');
  const [flode, inkorg, arenden, kalender] = await Promise.all([
    hamta('/api/admin/flode', (d) => (d.kunder as FlodeKund[]).filter((k) => k.nya > 0).length),
    hamta('/api/admin/inkorg', (d) => d.konversationer as InkorgKonversation[]),
    hamta('/api/admin/arenden', (d) => d.arenden as Arende[]),
    hamta(`/api/admin/kalender?fran=${idag}&tom=${idag}`, (d) => ((d.handelser as unknown[]).length + (d.moten as unknown[]).length)),
  ]);

  const oppna = (arenden ?? []).filter((a) => a.status === 'oppen' && a.datum && a.datum <= idag);

  return {
    '/admin/flode': flode !== null ? { antal: flode, bradskande: false } : null,
    '/admin/inkorg': inkorg ? { antal: inkorg.filter((k) => k.olast).length, bradskande: false } : null,
    '/admin/arenden': arenden ? { antal: oppna.length, bradskande: oppna.some((a) => a.datum! < idag) } : null,
    '/admin/kalender': kalender !== null ? { antal: kalender, bradskande: false } : null,
  };
}

export default function NavMenu() {
  const pathname = usePathname();
  const [raknare, setRaknare] = useState<Raknare>({});

  const ladda = useCallback(() => { raknaAlla().then(setRaknare); }, []);

  useEffect(() => {
    const t = setInterval(ladda, POLL_MS);
    const onFocus = () => ladda();
    window.addEventListener('focus', onFocus);
    // Sidorna kan be om en ny räkning när något ändrats, t.ex. inkorgen när en konversation lästs
    window.addEventListener(RAKNA_OM, onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); window.removeEventListener(RAKNA_OM, onFocus); };
  }, [ladda]);

  // Byte av sida räknar om — det man just gjort (läst, bockat av) ska synas direkt
  useEffect(() => { ladda(); }, [ladda, pathname]);

  return (
    <div className="flex items-center gap-5">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative text-sm transition hover:text-blue-700 ${arAktiv(pathname, item.href) ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
        >
          {item.label}
          <Siffra r={raknare[item.href]} />
        </Link>
      ))}
      <Mer pathname={pathname} raknare={raknare} />
    </div>
  );
}

/** Dropdownen Mer. Siffrorna på sidorna i den summeras på knappen. */
function Mer({ pathname, raknare }: { pathname: string | null; raknare: Raknare }) {
  const [oppen, setOppen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Stängs vid sidbyte, klick utanför och Escape
  useEffect(() => { setOppen(false); }, [pathname]);
  useEffect(() => {
    if (!oppen) return;
    const klick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOppen(false); };
    const tangent = (e: KeyboardEvent) => { if (e.key === 'Escape') setOppen(false); };
    document.addEventListener('mousedown', klick);
    document.addEventListener('keydown', tangent);
    return () => { document.removeEventListener('mousedown', klick); document.removeEventListener('keydown', tangent); };
  }, [oppen]);

  const siffror = MER.map((m) => raknare[m.href]).filter((r): r is { antal: number; bradskande: boolean } => !!r && r.antal > 0);
  const summa = siffror.length ? { antal: siffror.reduce((a, r) => a + r.antal, 0), bradskande: siffror.some((r) => r.bradskande) } : null;
  const aktiv = MER.some((m) => arAktiv(pathname, m.href));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOppen((o) => !o)}
        aria-expanded={oppen}
        className={`relative flex items-center gap-1 text-sm transition hover:text-blue-700 ${aktiv ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
      >
        Mer
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`transition ${oppen ? 'rotate-180' : ''}`}>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!oppen && <Siffra r={summa} />}
      </button>
      {oppen && (
        <div className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {MER.map((m) => {
            const r = raknare[m.href];
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50 ${arAktiv(pathname, m.href) ? 'text-slate-900 font-medium' : 'text-slate-700'}`}
              >
                {m.label}
                {r && r.antal > 0 && (
                  <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-[18px] text-center text-white tabular-nums ${r.bradskande ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {r.antal > 99 ? '99+' : r.antal}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
