/**
 * Bygger kontextblocket om en kund som skickas med till AI:n i testmiljön
 * (/ai-test). Samma tanke som buildSenderContext i mail-AI:n, fast här väljer
 * du kunden själv i gränssnittet istället för att den kommer från avsändaren.
 */

export const KUND_KOLUMNER =
  'id, full_name, email, company_name, org_nr, momsnr, verksamhet, ort, ' +
  'moms_period, bokforing_metod, saljer_till, saljer_i, koper_i, start_ar';

export interface Kund {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  org_nr: string | null;
  momsnr: string | null;
  verksamhet: string | null;
  ort: string | null;
  moms_period: string | null;
  bokforing_metod: string | null;
  saljer_till: string | null;
  saljer_i: string | null;
  koper_i: string | null;
  start_ar: number | null;
}

const MOMS_PERIOD: Record<string, string> = {
  monthly: 'månadsvis',
  quarterly: 'kvartalsvis',
  yearly: 'årsvis',
  månadsvis: 'månadsvis',
  kvartalsvis: 'kvartalsvis',
  helår: 'helår',
  'ingen-moms': 'ej momsregistrerad',
};

const SALJER_TILL: Record<string, string> = {
  privat: 'privatpersoner',
  foretag: 'företag',
};

const OMRADE: Record<string, string> = {
  sverige: 'Sverige',
  eu: 'EU',
  'utanfor-eu': 'utanför EU',
  import: 'import (utanför EU)',
};

/**
 * Returnerar ett textblock att lägga till i systemprompten, eller tom sträng
 * om kunden inte har några uppgifter alls.
 */
export function byggKundkontext(k: Kund | null): string {
  if (!k) return '';

  const rader: string[] = [];
  if (k.company_name) rader.push(`- Företag: ${k.company_name}`);
  if (k.full_name) rader.push(`- Innehavare: ${k.full_name}`);
  if (k.verksamhet) rader.push(`- Verksamhet: ${k.verksamhet}`);
  if (k.org_nr) rader.push(`- Org.nr: ${k.org_nr}`);
  if (k.momsnr) rader.push(`- Momsreg.nr: ${k.momsnr}`);
  if (k.ort) rader.push(`- Ort: ${k.ort}`);
  if (k.moms_period) rader.push(`- Momsperiod: ${MOMS_PERIOD[k.moms_period] ?? k.moms_period}`);
  if (k.bokforing_metod) rader.push(`- Bokföringsmetod: ${k.bokforing_metod}`);
  if (k.saljer_till) rader.push(`- Säljer till: ${SALJER_TILL[k.saljer_till] ?? k.saljer_till}`);
  if (k.saljer_i) rader.push(`- Säljer i: ${OMRADE[k.saljer_i] ?? k.saljer_i}`);
  if (k.koper_i) rader.push(`- Köper i: ${OMRADE[k.koper_i] ?? k.koper_i}`);
  if (k.start_ar) rader.push(`- Startår: ${k.start_ar}`);

  if (rader.length === 0) return '';

  return `OM KUNDEN (företaget vars underlag du analyserar):
${rader.join('\n')}

Använd verksamhetsbeskrivningen för att välja rimliga konton och för att tolka otydliga poster — en frisör och en konsult bokför samma inköp olika. Hitta inte på uppgifter som inte står här, och ändra inte belopp eller datum utifrån dem.`;
}

/** Kort etikett för listan i gränssnittet. */
export function kundNamn(k: Kund): string {
  return k.company_name || k.full_name || k.email || 'Namnlös kund';
}
