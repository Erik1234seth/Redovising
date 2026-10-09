'use client';

import { useRef, useState } from 'react';
import type {
  BokslutData, BokslutManuell, BokslutPunktId, BokslutStatus, MomsPeriod, Person, PersonUnderlag, Redovisningsmetod,
} from '@/lib/admin-types';
import { REDOVISNINGSMETODER, MOMSPERIODER, fullDate } from './_pipeline';
import { momsnrFranOrgnr } from '@/lib/momsnr';

/**
 * Bokslutschecklistan på personkortet: vad som finns och vad som måste in
 * innan bokslutet kan göras.
 *
 * Varje punkt fylls i direkt på sin rad — orgnumret skrivs in, metoden och
 * momsperioden väljs, NE-bilagan och inventarielistan laddas upp. Färgen
 * räknas fram ur det som finns; det enda som sätts för hand är "behövs inte"
 * på underlagen, när kunden inte har någon NE-bilaga eller något lager.
 */

export const STATUS_STYLE: Record<BokslutStatus, {
  label: string; pill: string; bar: string; border: string; dot: string;
}> = {
  saknas: { label: 'Saknas', pill: 'bg-red-500/20 text-red-300', bar: 'bg-red-500', border: 'border-l-red-500', dot: 'bg-red-500' },
  kolla: { label: 'Kolla', pill: 'bg-amber-500/20 text-amber-300', bar: 'bg-amber-400', border: 'border-l-amber-400', dot: 'bg-amber-400' },
  klart: { label: 'Finns', pill: 'bg-emerald-500/20 text-emerald-300', bar: 'bg-emerald-500', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  ej: { label: 'Behövs inte', pill: 'bg-navy-600 text-warm-400', bar: 'bg-navy-500', border: 'border-l-navy-500', dot: 'bg-warm-600' },
};

const ORDNING: BokslutStatus[] = ['saknas', 'kolla', 'klart', 'ej'];

// Momsperioderna i admin har också "ingen moms", som kunden kan välja i onboardingen
const MOMSVAL: { value: MomsPeriod; label: string }[] = [...MOMSPERIODER, { value: 'ingen-moms', label: 'Ingen moms' }];

/** Punkterna där en fil laddas upp och kopplas till punkten. */
export type UppladdningsPunkt = 'ne' | 'lager' | 'underlag';

export interface BokslutPunkt {
  id: BokslutPunktId;
  grupp: 'kund' | 'underlag';
  label: string;
  /** Vad checklistan hittade, i klartext. */
  vardet: string;
  /** Statusen checklistan räknade fram själv. */
  auto: BokslutStatus;
  /** Statusen som gäller: "behövs inte" om det satts, annars auto. */
  status: BokslutStatus;
  manuell: BokslutManuell | null;
  /** Filer bland underlagen som hör till punkten. */
  filer: PersonUnderlag[];
}

const TOM: BokslutData = {
  orgNr: null, momsNr: null, forstaAret: null, startAr: null, inventarier: 0, lagerposter: 0, manuellt: {}, neUppgifter: {},
};

// Filnamn som ser ut att vara en NE-bilaga eller en deklaration, respektive en lager- eller inventarielista
const NE_FIL = /ne[\s_-]?bilaga|(^|[^a-zåäö])ne([^a-zåäö]|$)|deklaration|ink\s?1/i;
const LAGER_FIL = /lager|inventari|tillgång/i;

const antal = (n: number, en: string, flera: string) => `${n} ${n === 1 ? en : flera}`;
const filer = (n: number) => (n === 1 ? 'en fil' : `${n} filer`);

export function bokslutPunkter(
  person: Person,
  data: BokslutData | null,
  underlag: PersonUnderlag[],
  verifikationer: number,
  transaktioner: number,
): BokslutPunkt[] {
  const d = data ?? TOM;
  // Filerna som laddats upp på punkten. Raderas filen faller punkten tillbaka
  // på gissningen, eftersom id:t då inte längre finns bland underlagen.
  const uppladdad = (id: BokslutPunktId) => underlag.find((f) => f.id === d.manuellt[id]?.underlagId) ?? null;
  const neUppladdad = uppladdad('ne');
  const lagerUppladdad = uppladdad('lager');
  const neFiler = neUppladdad ? [neUppladdad] : underlag.filter((f) => NE_FIL.test(f.fileName));
  const lagerFiler = lagerUppladdad ? [lagerUppladdad] : underlag.filter((f) => LAGER_FIL.test(f.fileName));
  const ingenMoms = person.momsPeriod === 'ingen-moms';
  const momsNr = d.momsNr ?? momsnrFranOrgnr(d.orgNr);
  const iAppen = d.inventarier + d.lagerposter;

  const rader: Omit<BokslutPunkt, 'status' | 'manuell'>[] = [
    {
      id: 'ne', grupp: 'underlag', label: 'Förra årets NE-bilaga', filer: neFiler,
      auto: neUppladdad ? 'klart'
        : d.forstaAret === true ? 'ej'
        : neFiler.length ? 'kolla'
        : d.forstaAret === false ? 'saknas' : 'kolla',
      vardet: neUppladdad
        ? `Uppladdad ${fullDate(neUppladdad.at)}`
        : d.forstaAret === true
        ? 'Första deklarationsåret — det finns ingen tidigare NE-bilaga'
        : neFiler.length
          ? `${filer(neFiler.length)} bland underlagen ser ut att vara den — ladda upp den rätta för att bocka av`
          : d.forstaAret === false
            ? 'Kunden har deklarerat förut, så den behövs för ingående balanser'
            : `Vet inte om det är första året${d.startAr ? ` (startår ${d.startAr})` : ''} — fråga kunden`,
    },
    {
      id: 'lager', grupp: 'underlag', label: 'Ingående lager & inventarielista', filer: lagerFiler,
      auto: lagerUppladdad || iAppen > 0 ? 'klart' : 'kolla',
      vardet: lagerUppladdad
        ? `Lista uppladdad ${fullDate(lagerUppladdad.at)}`
        : iAppen > 0
        ? `${[d.inventarier && antal(d.inventarier, 'inventarie', 'inventarier'), d.lagerposter && antal(d.lagerposter, 'lagerpost', 'lagerposter')].filter(Boolean).join(' och ')} inlagda i appen`
        : lagerFiler.length
          ? `Inget inlagt i appen, men ${filer(lagerFiler.length)} bland underlagen ser ut att vara en lista`
          : 'Inget inlagt — fråga om kunden har lager eller inventarier',
    },
    {
      id: 'underlag', grupp: 'underlag', label: 'Årets bokföring & underlag', filer: [],
      auto: verifikationer + transaktioner > 0 ? 'klart' : underlag.length ? 'kolla' : 'saknas',
      vardet: verifikationer + transaktioner > 0
        ? [
          verifikationer && antal(verifikationer, 'verifikation', 'verifikationer'),
          transaktioner && antal(transaktioner, 'transaktion', 'transaktioner'),
        ].filter(Boolean).join(' och ') + ` från ${antal(underlag.length, 'fil', 'filer')}`
        : underlag.length
          ? `${antal(underlag.length, 'fil', 'filer')} inkomna men inget utläst än`
          : 'Inga underlag inkomna',
    },
    {
      id: 'orgnr', grupp: 'kund', label: 'Organisationsnummer', filer: [],
      auto: d.orgNr ? 'klart' : 'saknas',
      vardet: d.orgNr ?? '',
    },
    {
      id: 'momsnr', grupp: 'kund', label: 'Momsregistreringsnummer (VAT)', filer: [],
      auto: ingenMoms ? 'ej' : momsNr ? 'klart' : 'saknas',
      vardet: ingenMoms ? 'Kunden redovisar inte moms' : momsNr ?? 'Fyll i organisationsnumret så skrivs det automatiskt',
    },
    {
      id: 'verksamhet', grupp: 'kund', label: 'Verksamhet', filer: [],
      auto: person.verksamhet ? 'klart' : 'saknas',
      vardet: person.verksamhet ?? '',
    },
    {
      id: 'metod', grupp: 'kund', label: 'Bokföringsmetod', filer: [],
      auto: person.redovisningsmetod ? 'klart' : 'saknas',
      vardet: '',
    },
    {
      id: 'moms', grupp: 'kund', label: 'Momsperiod', filer: [],
      auto: person.momsPeriod ? 'klart' : 'saknas',
      vardet: '',
    },
  ];

  return rader.map((r) => {
    const manuell = d.manuellt[r.id] ?? null;
    return { ...r, manuell, status: manuell?.status ?? r.auto };
  });
}

interface Props {
  person: Person;
  data: BokslutData | null;
  punkter: BokslutPunkt[];
  onData: (data: BokslutData) => void;
  onVerksamhet: (verksamhet: string | null) => void;
  onMetod: (metod: Redovisningsmetod) => void;
  onMoms: (moms: MomsPeriod) => void;
  onError: (message: string) => void;
  /** Laddar upp en fil bland kundens underlag och kopplar den till punkten. */
  onUpload: (punkt: UppladdningsPunkt, files: File[]) => void;
  /** Filen som laddas upp just nu, när det pågår. */
  uploading: string | null;
  /** Personen har konto eller mejladress att lägga filen på. */
  canUpload: boolean;
}

export function BokslutChecklista(props: Props) {
  const { person, data, punkter, onData, onError } = props;
  const [sparar, setSparar] = useState<string | null>(null);
  // Grupperna är stängda tills man klickar på dem
  const [oppna, setOppna] = useState<BokslutPunkt['grupp'][]>([]);
  const kanSpara = !!person.profileId && !!data;

  const spara = async (nyckel: string, body: object) => {
    if (!kanSpara) return null;
    setSparar(nyckel);
    const res = await fetch('/api/admin/people/bokslut', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: person.profileId, ...body }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setSparar(null);
    if (!res?.ok) { onError(json?.error || 'Checklistan kunde inte sparas'); return null; }
    return json as { manuellt?: BokslutData['manuellt']; momsNr?: string | null };
  };

  const sattStatus = async (punkt: BokslutPunktId, status: BokslutStatus | null) => {
    const svar = await spara(punkt, { punkt, status });
    if (svar?.manuellt && data) onData({ ...data, manuellt: svar.manuellt });
  };

  const sattOrgnr = async (varde: string) => {
    const svar = await spara('orgnr', { orgNr: varde });
    if (svar && data) onData({ ...data, orgNr: varde.trim() || null, momsNr: svar.momsNr ?? data.momsNr });
  };

  const sattVerksamhet = async (varde: string) => {
    const svar = await spara('verksamhet', { verksamhet: varde });
    if (svar) props.onVerksamhet(varde.trim() || null);
  };

  const per = (s: BokslutStatus) => punkter.filter((p) => p.status === s).length;
  const aktuella = punkter.filter((p) => p.status !== 'ej').length;

  return (
    <div className="space-y-8">
      {/* Sammanfattningen: hur nära bokslutet vi är, och en stapel i
          samma färger som punkterna nedanför */}
      <section>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className={`text-2xl font-bold ${per('saknas') ? 'text-white' : 'text-emerald-300'}`}>
              {per('saknas') === 0 && per('kolla') === 0
                ? '✓ Allt finns för bokslutet'
                : `${per('klart')} av ${aktuella} klara`}
            </p>
            <p className="text-warm-500 text-xs mt-1">
              {[
                per('saknas') && `${per('saknas')} saknas`,
                per('kolla') && `${per('kolla')} att kolla`,
                per('ej') && `${per('ej')} behövs inte`,
              ].filter(Boolean).join(' · ') || 'Inget saknas'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {ORDNING.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[11px] text-warm-400">
                <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[s].dot}`} />
                {STATUS_STYLE[s].label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden mt-4 gap-0.5 bg-navy-800">
          {ORDNING.flatMap((s) => punkter.filter((p) => p.status === s)).map((p) => (
            <span key={p.id} title={p.label} className={`flex-1 ${STATUS_STYLE[p.status].bar}`} />
          ))}
        </div>

        {!kanSpara && (
          <p className="mt-4 text-amber-300/90 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            Personen har inget konto än, så det mesta går inte att fylla i förrän kontot finns.
          </p>
        )}
      </section>

      <div className="space-y-3">
        {([
          ['underlag', 'Underlag som behövs'],
          ['kund', 'Uppgifter om kunden'],
        ] as const).map(([grupp, rubrik]) => {
          const rader = punkter.filter((p) => p.grupp === grupp);
          const saknas = rader.filter((p) => p.status === 'saknas').length;
          const kolla = rader.filter((p) => p.status === 'kolla').length;
          const oppen = oppna.includes(grupp);
          // Ikonen säger om gruppen behöver mer: rött utropstecken när något
          // saknas, gult när något ska kollas, grön bock när allt är klart
          const ikon = saknas
            ? { tecken: '!', klass: 'bg-red-500 text-white', text: `${saknas} saknas` }
            : kolla
            ? { tecken: '?', klass: 'bg-amber-400 text-navy-900', text: `${kolla} att kolla` }
            : { tecken: '✓', klass: 'bg-emerald-500 text-white', text: 'Allt klart' };
          return (
            <section key={grupp} className="bg-navy-800/30 border border-navy-600 rounded-xl">
              <button
                onClick={() => setOppna((l) => (oppen ? l.filter((g) => g !== grupp) : [...l, grupp]))}
                aria-expanded={oppen}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-navy-700/40 rounded-xl transition"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ikon.klass}`}>
                  {ikon.tecken}
                </span>
                <span className="text-xs font-semibold text-warm-200 uppercase tracking-widest">{rubrik}</span>
                <span className={`text-[11px] ${saknas ? 'text-red-300' : kolla ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {ikon.text}
                </span>
                <span className={`ml-auto text-warm-500 transition-transform ${oppen ? 'rotate-90' : ''}`}>›</span>
              </button>
              {oppen && (
                <ul className="space-y-2 px-4 pb-4">
                  {rader.map((p) => (
                    <Rad key={p.id} punkt={p}>
                      <Atgard
                        punkt={p}
                        {...props}
                        kanSpara={kanSpara}
                        sparar={sparar === p.id}
                        onStatus={(status) => sattStatus(p.id, status)}
                        onOrgnr={sattOrgnr}
                        onVerksamhetSpara={sattVerksamhet}
                      />
                    </Rad>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Rad({ punkt: p, children }: { punkt: BokslutPunkt; children: React.ReactNode }) {
  const stil = STATUS_STYLE[p.status];
  return (
    <li className={`bg-navy-800/40 border border-navy-600 border-l-4 ${stil.border} rounded-lg px-4 py-3`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${stil.pill}`}>
          {stil.label}
        </span>
        <span className="text-white text-sm font-semibold">{p.label}</span>
      </div>
      <div className="mt-2">{children}</div>
    </li>
  );
}

/** Det som går att göra på en punkt: ett fält, ett val eller en uppladdning. */
function Atgard(props: Props & {
  punkt: BokslutPunkt;
  kanSpara: boolean;
  sparar: boolean;
  onStatus: (status: BokslutStatus | null) => void;
  onOrgnr: (varde: string) => void;
  onVerksamhetSpara: (varde: string) => void;
}) {
  const { punkt: p, person, data, kanSpara, sparar } = props;
  const [utkast, setUtkast] = useState(p.id === 'orgnr' ? data?.orgNr ?? '' : person.verksamhet ?? '');
  const fileInput = useRef<HTMLInputElement>(null);

  const input = 'bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-warm-600 focus:outline-none focus:border-gold-500 transition disabled:opacity-50';

  if (p.id === 'orgnr') {
    return (
      <input
        value={utkast}
        onChange={(e) => setUtkast(e.target.value)}
        onBlur={() => { if (utkast.trim() !== (data?.orgNr ?? '')) props.onOrgnr(utkast); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        disabled={!kanSpara || sparar}
        placeholder="ÅÅMMDD-XXXX"
        className={`w-56 max-w-full ${input}`}
      />
    );
  }

  if (p.id === 'momsnr') {
    return (
      <p className={`text-sm ${p.status === 'saknas' ? 'text-red-300/90' : 'text-warm-200'}`}>
        <span className="font-mono">{p.vardet}</span>
        {p.status === 'klart' && <span className="text-warm-600 text-[11px] ml-2">skrivs automatiskt ur organisationsnumret</span>}
      </p>
    );
  }

  if (p.id === 'verksamhet') {
    return (
      <textarea
        value={utkast}
        onChange={(e) => setUtkast(e.target.value)}
        onBlur={() => { if (utkast.trim() !== (person.verksamhet ?? '')) props.onVerksamhetSpara(utkast); }}
        disabled={!kanSpara || sparar}
        rows={2}
        placeholder="Vad gör firman? T.ex. frisörsalong, säljer kläder online"
        className={`w-full resize-y ${input}`}
      />
    );
  }

  if (p.id === 'metod' || p.id === 'moms') {
    const val = p.id === 'metod'
      ? REDOVISNINGSMETODER.map((m) => ({ value: m.value as string, label: m.label, vald: person.redovisningsmetod === m.value }))
      : MOMSVAL.map((m) => ({ value: m.value as string, label: m.label, vald: person.momsPeriod === m.value }));
    // Metoden går att spara på en kontaktförfrågan också; momsperioden bara på kontot
    const kan = p.id === 'metod' ? !!(person.profileId || person.contactId) : !!person.profileId;
    return (
      <div className="flex flex-wrap gap-2">
        {val.map((v) => (
          <button
            key={v.value}
            onClick={() => (p.id === 'metod'
              ? props.onMetod(v.value as Redovisningsmetod)
              : props.onMoms(v.value as MomsPeriod))}
            disabled={!kan}
            aria-pressed={v.vald}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              v.vald
                ? 'bg-gold-500/15 border-gold-500 text-gold-400 font-semibold'
                : 'bg-navy-800/40 border-navy-600 text-warm-300 hover:border-warm-500'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${v.vald ? 'bg-gold-500 border-gold-500' : 'border-navy-500'}`} />
            {v.label}
          </button>
        ))}
      </div>
    );
  }

  // Underlagen: vad som finns, filerna, och knappen för att ladda upp
  const uppladdning = p.id as UppladdningsPunkt;
  const behovsInte = p.manuell?.status === 'ej';
  const knapp = {
    ne: p.auto === 'klart' ? 'Byt NE-bilaga' : '+ Ladda upp NE-bilaga',
    lager: p.manuell?.underlagId && p.auto === 'klart' ? 'Byt lista' : '+ Ladda upp lager-/inventarielista',
    underlag: '+ Ladda upp underlag',
  }[uppladdning];

  return (
    <>
      <p className={`text-sm break-words ${p.status === 'saknas' ? 'text-red-300/90' : 'text-warm-300'}`}>
        {behovsInte ? 'Markerad som att den inte behövs.' : p.vardet}
      </p>

      {p.filer.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {p.filer.map((f) => (
            <a
              key={f.id}
              href={`/api/admin/underlag/${f.id}/ladda-ner`}
              title={`Ladda ner · inkom ${fullDate(f.at)}`}
              className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 text-[10px] font-semibold break-all transition"
            >
              📎 {f.fileName}
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <input
          ref={fileInput}
          type="file"
          multiple={uppladdning === 'underlag'}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) props.onUpload(uppladdning, [...e.target.files]);
            e.target.value = '';
          }}
        />
        {!behovsInte && (
          <button
            onClick={() => fileInput.current?.click()}
            disabled={!props.canUpload || !!props.uploading}
            className="px-3 py-1.5 text-xs bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/30 text-gold-400 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {knapp}
          </button>
        )}
        {/* NE-bilaga och lager finns inte hos alla — då bockas punkten av som "behövs inte" */}
        {uppladdning !== 'underlag' && kanSpara && (behovsInte || p.auto === 'saknas' || p.auto === 'kolla') && (
          <button
            onClick={() => props.onStatus(behovsInte ? null : 'ej')}
            disabled={sparar}
            className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 border border-navy-600 text-warm-300 rounded-lg transition disabled:opacity-50"
          >
            {behovsInte ? '↺ Behövs ändå' : uppladdning === 'ne' ? 'Behövs inte' : 'Har inget lager eller inventarier'}
          </button>
        )}
        {props.uploading && <span className="text-gold-400 text-xs">Laddar upp {props.uploading}…</span>}
      </div>
    </>
  );
}
