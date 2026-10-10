'use client';

import { useMemo, useState } from 'react';
import type { AdminVerifikation, MomsPeriod } from '@/lib/admin-types';
import {
  RUTNAMN, arMomsavrakning, byggEskd, eskdOrgNr, eskdPeriod, ignoreradeKonton, latin1, periodDatum, raknaRutor,
  type Periodtyp, type Ruta,
} from '@/lib/moms/eskd';
import { Varningar } from './_varningar';
import { DragFil } from './_dragfil';

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

export function MomsFil({ verifikationer, orgNr, momsPeriod, lastPeriod }: {
  verifikationer: AdminVerifikation[];
  orgNr: string | null;
  momsPeriod: MomsPeriod | null;
  /** Låser panelen till en period och döljer periodvalet, som på inlämningssidan. */
  lastPeriod?: { typ: Periodtyp; ar: number; nr: number };
}) {
  const [valdTyp, setTyp] = useState<Periodtyp>(TYP_FOR_PERIOD[momsPeriod ?? 'månadsvis']);
  const start = forraPerioden(valdTyp);
  const [valtAr, setAr] = useState(start.ar);
  const [valtNr, setNr] = useState(start.nr);
  const [visaFil, setVisaFil] = useState(false);
  const typ = lastPeriod?.typ ?? valdTyp;
  const ar = lastPeriod?.ar ?? valtAr;
  const nr = lastPeriod?.nr ?? valtNr;

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

  const xml = formatOrgNr ? byggEskd({ orgNr: formatOrgNr, tom, rutor }) : null;
  const filnamn = formatOrgNr ? `moms_${formatOrgNr.replace('-', '')}_${eskdPeriod(tom)}.xml` : '';
  const bytes = useMemo(() => (xml ? latin1(xml) : null), [xml]);

  const laddaNer = () => {
    if (!formatOrgNr || !xml) return;
    const blob = new Blob([latin1(xml)], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filnamn;
    a.click();
    URL.revokeObjectURL(url);
  };

  const select = 'bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-2 py-1.5';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="text-slate-900 text-sm font-semibold mr-auto">Momsdeklaration som fil</h3>
        {!lastPeriod && <>
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
        </>}
        <button
          onClick={() => setVisaFil(!visaFil)}
          disabled={!xml}
          className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {visaFil ? 'Dölj filen' : 'Visa filen'}
        </button>
        <button
          onClick={laddaNer}
          disabled={!formatOrgNr}
          title={formatOrgNr ? 'Ladda upp filen i Skatteverkets e-tjänst Lämna momsdeklaration' : 'Organisationsnummer saknas'}
          className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Ladda ner momsfil
        </button>
      </div>

      {!formatOrgNr && (
        <p className="text-red-600 text-xs mb-3">
          Organisationsnummer saknas eller är fel — det behövs i filen. Det står på kundens profil (org_nr).
        </p>
      )}

      <Varningar varningar={varningar} className="mb-3" />

      {bytes && (
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <DragFil namn={filnamn} mime="application/xml" bytes={bytes} />
          <span className="text-[11px] text-slate-500">Dra filen till Skatteverkets fönster</span>
        </div>
      )}

      <p className="text-slate-500 text-xs mb-2">
        {fran} – {tom} · {antal} {antal === 1 ? 'verifikation' : 'verifikationer'}
        {formatOrgNr && <> · {formatOrgNr}</>}
      </p>

      {visade.length === 0 ? (
        <p className="text-slate-500 text-xs">Inget att redovisa i perioden — filen blir en nolldeklaration.</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {visade.map((r) => (
              <tr key={r} className="border-t border-slate-200">
                <td className="py-1 pr-3 text-slate-500 w-10">{r}</td>
                <td className="py-1 pr-3 text-slate-700">{RUTNAMN[r]}</td>
                <td className="py-1 text-right text-slate-900 tabular-nums">{kr.format(rutor[r] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-between border-t border-slate-200 mt-1 pt-2 text-xs">
        <span className="text-slate-700"><span className="text-slate-500 mr-3">49</span>{betala < 0 ? 'Moms att få tillbaka' : 'Moms att betala'}</span>
        <span className="text-slate-900 font-semibold tabular-nums">{kr.format(Math.abs(betala))} kr</span>
      </div>

      {visaFil && xml && (
        <pre className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-700 overflow-x-auto whitespace-pre">
          {xml.replace(/></g, '>\n<')}
        </pre>
      )}
    </div>
  );
}
