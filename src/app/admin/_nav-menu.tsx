'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Arende, InkorgKonversation, InlamningKund } from '@/lib/admin-types';

/**
 * Huvudsidorna, som vanliga länkar i menyraden — ingen dropdown.
 *
 * SMS-utkast, Underlag, Möten och Systemstatus togs bort härifrån 2026-10-10.
 * Sidorna finns kvar på sina adresser tills Inkorgen, Ärenden och Översikten
 * tar över det de gör.
 *
 * Siffran i hörnet räknas som på översikten, från samma routes som sidorna:
 * - Inkorg: olästa konversationer
 * - Ärenden: öppna ärenden för idag och försenade
 * - Kalender: det som står i kalendern idag, med möten
 * - Inlämning: perioder kvar att lämna in, moms och NE, med deadline inom en vecka eller passerad
 * Röd när något är försenat. En siffra som inte gick att hämta visas inte alls.
 */

const ITEMS: { href: string; label: string }[] = [
  { href: '/admin/inkorg', label: 'Inkorg' },
  { href: '/admin/arenden', label: 'Ärenden' },
  { href: '/admin/kalender', label: 'Kalender' },
  { href: '/admin/inlamning', label: 'Inlämning' },
  { href: '/admin/flodesschema', label: 'Flödesschema' },
];

const POLL_MS = 60_000;

/** Skickas med `window.dispatchEvent(new Event(RAKNA_OM))` när siffrorna ska räknas om direkt. */
export const RAKNA_OM = 'admin:rakna-om';

type Raknare = Record<string, { antal: number; bradskande: boolean } | null>;

const hamta = <T,>(url: string, valj: (d: Record<string, unknown>) => T): Promise<T | null> =>
  fetch(url).then((r) => r.json()).then((d) => (d.error ? null : valj(d))).catch(() => null);

async function raknaAlla(): Promise<Raknare> {
  const idag = new Date().toLocaleDateString('sv-SE');
  const omEnVecka = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString('sv-SE');
  const [inkorg, arenden, kalender, moms, ne] = await Promise.all([
    hamta('/api/admin/inkorg', (d) => d.konversationer as InkorgKonversation[]),
    hamta('/api/admin/arenden', (d) => d.arenden as Arende[]),
    hamta(`/api/admin/kalender?fran=${idag}&tom=${idag}`, (d) => ((d.handelser as unknown[]).length + (d.moten as unknown[]).length)),
    hamta('/api/admin/inlamning?typ=moms', (d) => d.kunder as InlamningKund[]),
    hamta('/api/admin/inlamning?typ=ne', (d) => d.kunder as InlamningKund[]),
  ]);

  const oppna = (arenden ?? []).filter((a) => a.status === 'oppen' && a.datum && a.datum <= idag);
  const kvar = moms && ne ? [...moms, ...ne].flatMap((k) => k.perioder).filter((p) => !p.inlamning && p.deadline <= omEnVecka) : null;

  return {
    '/admin/inkorg': inkorg ? { antal: inkorg.filter((k) => k.olast).length, bradskande: false } : null,
    '/admin/arenden': arenden ? { antal: oppna.length, bradskande: oppna.some((a) => a.datum! < idag) } : null,
    '/admin/kalender': kalender !== null ? { antal: kalender, bradskande: false } : null,
    '/admin/inlamning': kvar ? { antal: kvar.length, bradskande: kvar.some((p) => p.forsenad) } : null,
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
      {ITEMS.map((item) => {
        const r = raknare[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative text-sm transition hover:text-blue-700 ${
              pathname?.startsWith(item.href) ? 'text-slate-900 font-medium' : 'text-slate-600'
            }`}
          >
            {item.label}
            {r && r.antal > 0 && (
              <span
                className={`absolute -top-2 -right-3.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-[18px] text-center text-white tabular-nums ${
                  r.bradskande ? 'bg-red-600' : 'bg-blue-600'
                }`}
              >
                {r.antal > 99 ? '99+' : r.antal}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
