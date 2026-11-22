'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Person, TimelineEvent } from '@/lib/admin-types';
import { EVENT_STYLE, MOMSPERIODER, REDOVISNINGSMETODER, fullDate } from '../_pipeline';
import { formatPhone } from '@/lib/sms/phone';

/**
 * Kundkontexten bredvid Flöde: det man behöver veta om kunden när man
 * granskar — verksamheten, metoden, momsen och de senaste händelserna.
 * Bara att läsa; det ändras i personkortet. Samma data som personkortet
 * hämtar (/api/admin/people?key=).
 */

const BETALSATT: Record<string, string> = { foretagskonto: 'Företagskonto', privatkonto: 'Privatkonto' };
const HISTORIK = 6;

export function KundKontext({ personKey }: { personKey: string }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [fel, setFel] = useState('');

  useEffect(() => {
    setPerson(null);
    setFel('');
    fetch(`/api/admin/people?key=${encodeURIComponent(personKey)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setFel(d.error); return; }
        setPerson(d.person);
        setEvents([...(d.events ?? [])].reverse());
      })
      .catch(() => setFel('Kunde inte hämta kunden'));
  }, [personKey]);

  const personkort = `/admin/person/${encodeURIComponent(personKey)}`;

  if (fel) return <p className="text-sm text-red-600">{fel}</p>;
  if (!person) return <p className="text-sm text-slate-400">Hämtar kunden…</p>;

  const metod = REDOVISNINGSMETODER.find((m) => m.value === person.redovisningsmetod)?.label;
  const moms = person.momsPeriod === 'ingen-moms' ? 'Ingen moms' : MOMSPERIODER.find((m) => m.value === person.momsPeriod)?.label;

  const rader: [string, React.ReactNode][] = [
    ['Bokföringsmetod', metod],
    ['Startår', person.startAr ? `${person.startAr}${person.forlangtRakenskapsar ? ' · förlängt år' : ''}` : null],
    ['Momsperiod', moms],
    ['Betalar via', person.betalsatt ? BETALSATT[person.betalsatt] ?? person.betalsatt : null],
    ['Periodisk sammanfattning', person.periodiskSammanfattning ? 'Ja' : 'Nej'],
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl text-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <h3 className="font-medium text-slate-900 mr-auto">Kundkontext</h3>
        <Link href={`${personkort}#kontext`} className="text-xs text-blue-700 hover:underline">Ändra</Link>
      </div>

      <div className="px-4 py-3 space-y-1 border-b border-slate-100 text-slate-600">
        {person.company && <p className="text-slate-900">{person.company}</p>}
        {person.email && <p className="truncate">{person.email}</p>}
        {person.phone && <p>{formatPhone(person.phone)}</p>}
      </div>

      <section className="px-4 py-3 border-b border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Verksamhet</h4>
        {person.verksamhet
          ? <p className="text-slate-800 whitespace-pre-wrap break-words leading-relaxed">{person.verksamhet}</p>
          : <p className="text-slate-400">Ingen beskrivning ifylld.</p>}
      </section>

      <dl className="px-4 py-3 border-b border-slate-100 space-y-1.5">
        {rader.map(([namn, varde]) => (
          <div key={namn} className="flex gap-3">
            <dt className="text-slate-500 w-36 shrink-0">{namn}</dt>
            <dd className={varde ? 'text-slate-900' : 'text-slate-400'}>{varde ?? 'Inte valt'}</dd>
          </div>
        ))}
      </dl>

      <section className="px-4 py-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Senaste händelser</h4>
        {events.length ? (
          <ul className="space-y-2">
            {events.slice(0, HISTORIK).map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex gap-2">
                <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${EVENT_STYLE[e.type]?.dot ?? 'bg-slate-300'}`} />
                <div className="min-w-0">
                  <p className={`truncate ${e.bad ? 'text-red-600' : 'text-slate-800'}`}>{e.title}</p>
                  <p className="text-[11px] text-slate-400">{EVENT_STYLE[e.type]?.label ?? e.type} · {fullDate(e.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-slate-400">Inget registrerat.</p>}
        {events.length > HISTORIK && (
          <Link href={`${personkort}#kontext`} className="block mt-2 text-xs text-blue-700 hover:underline">Hela historiken →</Link>
        )}
      </section>
    </div>
  );
}
