import { deadlinesMellan, momsperiod, neperiod, vardag } from '@/lib/deadlines';

/**
 * Det som står i kalendern utöver kundernas egna deadlines: årets fasta
 * datum och de planerade utskicken till kunderna.
 *
 * Utskicken är bara noteringar än så länge — inget skickas automatiskt.
 * Texterna och datumen är Eriks lista från 2026-10-10.
 */

export type HandelseTyp = 'deadline' | 'utskick' | 'info';

/** Vilka kunder en deadline gäller — kalendern hänger på kundkorten efter den här. */
export type DeadlineGrupp = 'moms-manad' | 'moms-kvartal' | 'moms-ar' | 'ne';

export interface Kalenderhandelse {
  datum: string;
  typ: HandelseTyp;
  titel: string;
  beskrivning?: string;
  grupp?: DeadlineGrupp;
  /** Perioden deadlinen gäller, som nyckel i `inlamningar.period`. */
  period?: string;
}

const d = (ar: number, manad: number, dag: number) =>
  `${ar}-${String(manad).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;

/** Sista dagen i en månad. */
const sista = (ar: number, manad: number) => new Date(Date.UTC(ar, manad, 0)).getUTCDate();

function arets(ar: number): Kalenderhandelse[] {
  const glomInte = 'Påminnelse till alla kunder om att skicka in förra årets underlag.';
  return [
    { datum: d(ar, 1, 1), typ: 'utskick', titel: 'Börja skicka in årets underlag', beskrivning: 'Mejl till alla kunder: nu kan förra årets underlag skickas in.' },
    { datum: d(ar, 1, 15), typ: 'utskick', titel: 'Glöm inte underlagen', beskrivning: glomInte },
    { datum: d(ar, 1, 31), typ: 'utskick', titel: 'Glöm inte underlagen', beskrivning: glomInte },
    { datum: d(ar, 2, 15), typ: 'utskick', titel: 'Glöm inte underlagen', beskrivning: glomInte },
    { datum: d(ar, 2, 1), typ: 'utskick', titel: 'Mejl till kunder med EU-handel', beskrivning: 'Kunder med helårsmoms och EU-handel måste vara klara till 26 februari.' },
    { datum: vardag(d(ar, 2, 26)), typ: 'deadline', titel: 'Helårsmoms med EU-handel', beskrivning: 'Sista dag för momsdeklarationen för den som redovisar moms per år och har handel med andra EU-länder.' },
    { datum: d(ar, 3, 1), typ: 'utskick', titel: 'Nu är det viktigt att underlagen kommer', beskrivning: 'Annars hinner vi inte deklarera i tid.' },
    { datum: d(ar, 3, 15), typ: 'utskick', titel: 'Nu är det viktigt att underlagen kommer', beskrivning: 'Annars hinner vi inte deklarera i tid.' },
    { datum: d(ar, 3, 17), typ: 'info', titel: 'Digitala deklarationen öppnar', beskrivning: 'E-tjänsten Inkomstdeklaration 1 öppnar ungefär nu — exakt datum varierar mellan åren.' },
    { datum: d(ar, 3, 31), typ: 'utskick', titel: 'Nu är det viktigt att underlagen kommer', beskrivning: 'Sista påminnelsen före deadline för underlagen 15 april.' },
    { datum: d(ar, 4, 15), typ: 'deadline', titel: 'Deadline för underlagen', beskrivning: 'Kunder som saknar uppgifter efter idag ska med på listan för byråanstånd. Kolla byråanstånd.' },
    { datum: neperiod(ar - 1).deadline, typ: 'deadline', grupp: 'ne', period: String(ar - 1), titel: 'Sista dag att deklarera (NE)', beskrivning: `Inkomstdeklarationen med NE-bilaga för inkomstår ${ar - 1}. Undantag: kunder med byråanstånd.` },
    { datum: momsperiod('år', ar - 1, 1).deadline, typ: 'deadline', grupp: 'moms-ar', period: String(ar - 1), titel: 'Helårsmoms', beskrivning: `Sista dag för momsdeklarationen för den som redovisar moms per år (${ar - 1}).` },
    { datum: vardag(d(ar, 6, 15)), typ: 'deadline', titel: 'Sista dag med byråanstånd', beskrivning: 'Inkomstdeklarationen för kunder med byråanstånd.' },
    { datum: vardag(d(ar, 6, 26)), typ: 'deadline', titel: 'Helårsmoms med byråanstånd', beskrivning: 'Gäller inte den som har EU-handel.' },
  ];
}

/**
 * Påminnelserna om momsen: den 20:e varje månad till månadsmomskunderna, och
 * den 20:e månaden före inlämning till kvartalskunderna.
 */
function momspaminnelser(fran: string, tom: string): Kalenderhandelse[] {
  const ut: Kalenderhandelse[] = [];
  // Månad: den 20:e påminner om perioden som ska in nästa månad (20 okt → september, in 12 nov)
  for (const p of deadlinesMellan('moms', 'månadsvis', fran, addMan(tom, 1))) {
    const [a, m] = p.deadline.split('-').map(Number);
    const dag = m === 1 ? d(a - 1, 12, 20) : d(a, m - 1, 20);
    if (dag >= fran && dag <= tom) {
      ut.push({ datum: dag, typ: 'utskick', titel: 'Påminnelse månadsmoms', beskrivning: `Till månadsmomskunderna: underlaget för ${p.label} behövs — momsen ska in ${p.deadline}.` });
    }
  }
  for (const p of deadlinesMellan('moms', 'kvartalsvis', fran, addMan(tom, 1))) {
    const [a, m] = p.deadline.split('-').map(Number);
    const dag = m === 1 ? d(a - 1, 12, 20) : d(a, m - 1, 20);
    if (dag >= fran && dag <= tom) {
      ut.push({ datum: dag, typ: 'utskick', titel: 'Påminnelse kvartalsmoms', beskrivning: `Till kvartalskunderna: underlaget för ${p.label} behövs — momsen ska in ${p.deadline}.` });
    }
  }
  return ut;
}

/** Ett datum en månad fram, för att få med deadlines vars påminnelse ligger i intervallet. */
function addMan(datum: string, man: number): string {
  const [a, m] = datum.split('-').map(Number);
  const nm = m + man;
  const ar = a + Math.floor((nm - 1) / 12);
  const mm = ((nm - 1) % 12) + 1;
  return d(ar, mm, sista(ar, mm));
}

/** Alla fasta händelser och påminnelser mellan två datum (inklusive). */
export function handelserMellan(fran: string, tom: string): Kalenderhandelse[] {
  const ar0 = Number(fran.slice(0, 4));
  const ar1 = Number(tom.slice(0, 4));
  const ut: Kalenderhandelse[] = [];
  for (let ar = ar0; ar <= ar1; ar++) ut.push(...arets(ar));
  ut.push(...momspaminnelser(fran, tom));
  for (const p of deadlinesMellan('moms', 'månadsvis', fran, tom)) {
    ut.push({ datum: p.deadline, typ: 'deadline', grupp: 'moms-manad', period: p.period, titel: `Månadsmoms ${p.label}`, beskrivning: 'Sista dag för deklaration och betalning.' });
  }
  for (const p of deadlinesMellan('moms', 'kvartalsvis', fran, tom)) {
    ut.push({ datum: p.deadline, typ: 'deadline', grupp: 'moms-kvartal', period: p.period, titel: `Kvartalsmoms ${p.label}`, beskrivning: 'Sista dag för deklaration och betalning.' });
  }
  return ut.filter((h) => h.datum >= fran && h.datum <= tom).sort((a, b) => a.datum.localeCompare(b.datum));
}
