'use client';

import { useMemo, useState } from 'react';
import type { AdminVerifikation, MomsPeriod } from '@/lib/admin-types';
import {
  RUTNAMN, arMomsavrakning, byggEskd, eskdOrgNr, eskdPeriod, ignoreradeKonton, latin1, periodDatum, raknaRutor,
  type Periodtyp, type Ruta,
} from '@/lib/moms/eskd';
import { Varningar } from './_varningar';

/**
 * Momsdeklarationen som fil för en period, räknad ur kundens verifikationer.
 * Rutorna visas innan filen laddas ner, så att det syns vad som skickas.
 * Filen laddas sedan upp i Skatteverkets e-tjänst "Lämna momsdeklaration".
 */

const MANADER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const TYP_FOR_PERIOD: Record<MomsPeriod, Periodtyp> = {
  'månadsvis': 'månad',
  'kvartalsvis': 'kvartal',
  'helår': 'år',
  'ingen-moms': 'månad',
};

/** Den senast avslutade perioden — den man oftast ska deklarera. */
function forraPerioden(typ: Periodtyp): { ar: number; nr: number } {
  const nu = new Date();
  const ar = nu.getFullYear();
  const manad = nu.getMonth() + 1;
  if (typ === 'år') return { ar: ar - 1, nr: 1 };
  if (typ === 'kvartal') {
    const kvartal = Math.ceil(manad / 3) - 1;
    return kvartal === 0 ? { ar: ar - 1, nr: 4 } : { ar, nr: kvartal };
  }
  return manad === 1 ? { ar: ar - 1, nr: 12 } : { ar, nr: manad - 1 };
}

const kr = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const kr2 = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const st = (n: number, en: string, flera: string) => `${n} ${n === 1 ? en : flera}`;
const namn = (v: AdminVerifikation) => `${v.serie}${v.nummer}`.trim() || v.datum || v.text || '?';

export function MomsFil({ verifikationer, orgNr, momsPeriod }: {
  verifikationer: AdminVerifikation[];
  orgNr: string | null;
  momsPeriod: MomsPeriod | null;
}) {
  const [typ, setTyp] = useState<Periodtyp>(TYP_FOR_PERIOD[momsPeriod ?? 'månadsvis']);
  const start = forraPerioden(typ);
  const [ar, setAr] = useState(start.ar);
  const [nr, setNr] = useState(start.nr);

  const byttTyp = (ny: Periodtyp) => {
    const p = forraPerioden(ny);
    setTyp(ny); setAr(p.ar); setNr(p.nr);
  };

  const { fran, tom } = periodDatum(ar, typ, nr);
  const formatOrgNr = eskdOrgNr(orgNr);

  /**
   * Allt som inte kommer med i rutorna räknas upp som varningar — en rad som
   * tyst faller bort syns annars först när Skatteverket hör av sig.
   */
  const { rutor, antal, varningar } = useMemo(() => {
    const varningar: string[] = [];
    const iPerioden = verifikationer.filter((v) => v.datum >= fran && v.datum <= tom);

    const odaterade = verifikationer.filter((v) => !v.datum);
    if (odaterade.length) {
      varningar.push(`${st(odaterade.length, 'verifikation', 'verifikationer')} saknar datum och kan inte hamna i någon period: ${odaterade.slice(0, 5).map(namn).join(', ')}${odaterade.length > 5 ? ' …' : ''}`);
    }

    const avrakningar = iPerioden.filter((v) => arMomsavrakning(v.transaktioner.filter((t) => !t.borttagen && !t.tillagd)));
    if (avrakningar.length) {
      varningar.push(`${st(avrakningar.length, 'verifikation', 'verifikationer')} mot 2650 (momsavräkning) räknas inte med: ${avrakningar.slice(0, 5).map(namn).join(', ')}`);
    }
    const medrakade = iPerioden.filter((v) => !avrakningar.includes(v));

    const obalanserade = medrakade.filter((v) => !v.balanserad);
    if (obalanserade.length) {
      varningar.push(`${st(obalanserade.length, 'verifikation', 'verifikationer')} i perioden går inte jämnt ut men är medräknade: ${obalanserade.slice(0, 5).map(namn).join(', ')}${obalanserade.length > 5 ? ' …' : ''}`);
    }

    const allaRader = medrakade.flatMap((v) => v.transaktioner);
    const struket = allaRader.filter((t) => t.borttagen || t.tillagd).length;
    if (struket) {
      varningar.push(`${st(struket, 'rad', 'rader')} markerade som borttagna eller tillagda i efterhand (SIE #BTRANS/#RTRANS) räknas inte med`);
    }
    const rader = allaRader.filter((t) => !t.borttagen && !t.tillagd);

    for (const k of ignoreradeKonton(rader)) {
      varningar.push(`Konto ${k.konto}${k.kontonamn ? ` ${k.kontonamn}` : ''} (${kr2.format(k.belopp)} kr) hamnar inte i någon ruta`);
    }

    return { rutor: raknaRutor(rader), antal: medrakade.length, varningar };
  }, [verifikationer, fran, tom]);

  const ar0 = new Date().getFullYear();
  const ars = [ar0 - 2, ar0 - 1, ar0];
  const visade = (Object.keys(rutor) as Ruta[]).filter((r) => r !== '49').sort();
  const betala = rutor['49'] ?? 0;

  const laddaNer = () => {
    if (!formatOrgNr) return;
    const xml = byggEskd({ orgNr: formatOrgNr, tom, rutor });
    const blob = new Blob([latin1(xml)], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moms_${formatOrgNr.replace('-', '')}_${eskdPeriod(tom)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const select = 'bg-navy-700 border border-navy-600 text-white text-xs rounded-lg px-2 py-1.5';

  return (
    <div className="bg-navy-800/60 border border-navy-700 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="text-white text-sm font-semibold mr-auto">Momsdeklaration som fil</h3>
        <select value={typ} onChange={(e) => byttTyp(e.target.value as Periodtyp)} className={select}>
          <option value="månad">Månad</option>
          <option value="kvartal">Kvartal</option>
          <option value="år">Helår</option>
        </select>
        {typ === 'månad' && (
          <select value={nr} onChange={(e) => setNr(Number(e.target.value))} className={select}>
            {MANADER.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        )}
        {typ === 'kvartal' && (
          <select value={nr} onChange={(e) => setNr(Number(e.target.value))} className={select}>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Kvartal {q}</option>)}
          </select>
        )}
        <select value={ar} onChange={(e) => setAr(Number(e.target.value))} className={select}>
          {ars.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={laddaNer}
          disabled={!formatOrgNr}
          title={formatOrgNr ? 'Ladda upp filen i Skatteverkets e-tjänst Lämna momsdeklaration' : 'Organisationsnummer saknas'}
          className="px-3 py-1.5 text-xs bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/30 text-gold-400 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Ladda ner momsfil
        </button>
      </div>

      {!formatOrgNr && (
        <p className="text-red-400 text-xs mb-3">
          Organisationsnummer saknas eller är fel — det behövs i filen. Det står på kundens profil (org_nr).
        </p>
      )}

      <Varningar varningar={varningar} className="mb-3" />

      <p className="text-warm-500 text-xs mb-2">
        {fran} – {tom} · {antal} {antal === 1 ? 'verifikation' : 'verifikationer'}
        {formatOrgNr && <> · {formatOrgNr}</>}
      </p>

      {visade.length === 0 ? (
        <p className="text-warm-500 text-xs">Inget att redovisa i perioden — filen blir en nolldeklaration.</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {visade.map((r) => (
              <tr key={r} className="border-t border-navy-700/60">
                <td className="py-1 pr-3 text-warm-500 w-10">{r}</td>
                <td className="py-1 pr-3 text-warm-300">{RUTNAMN[r]}</td>
                <td className="py-1 text-right text-white tabular-nums">{kr.format(rutor[r] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-between border-t border-navy-600 mt-1 pt-2 text-xs">
        <span className="text-warm-300"><span className="text-warm-500 mr-3">49</span>{betala < 0 ? 'Moms att få tillbaka' : 'Moms att betala'}</span>
        <span className="text-white font-semibold tabular-nums">{kr.format(Math.abs(betala))} kr</span>
      </div>
    </div>
  );
}
