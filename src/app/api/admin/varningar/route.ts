import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { kanLasasAvAi } from '@/lib/underlag/filtyp';
import { isSieFile } from '@/lib/sie/parse';
import { arVarAdress } from '@/lib/underlag/var-fil';
import { explainError } from '@/lib/personer';
import type { AdminVarning } from '@/lib/admin-types';

/**
 * Allt som gått fel, för översikten. Inget sållas bort: varje steg som
 * sparar ett fel, varje underlag som fastnat på vägen och varje mejl som
 * inte tagits om hand syns här tills det är åtgärdat.
 *
 * De flesta varningar försvinner av sig själva när felet är åtgärdat (felet
 * nollställs när steget lyckas). Misslyckade utskick ligger kvar tills någon
 * markerat dem som hanterade, samma som i personkortet.
 */

/** Så länge får ett steg ta innan det räknas som fastnat. */
const GRACE_MS = 30 * 60 * 1000;
/** Bilagor i mejl har sparats som underlag sedan dess. */
const BILAGOR_SEDAN = '2026-10-08T00:00:00Z';
/** Underlagskontrollen av mejlade underlag finns sedan dess. */
const KONTROLL_SEDAN = '2026-10-11T00:00:00Z';
/** check-inbox styrs av inmail_behandlade sedan dess. */
const BEHANDLADE_SEDAN = '2026-10-25T09:11:00Z';

type Varning = AdminVarning;

const STEG: [kolumn: string, namn: string][] = [
  ['definition_fel', 'Definiera underlaget'],
  ['transaktioner_fel', 'Avläsning av transaktioner'],
  ['verifikationer_fel', 'Inläsning av verifikationer'],
  ['komplettering_fel', 'Komplettera med kundhistorik'],
  ['dublettkoll_fel', 'Dublettcheck'],
  ['tillrackligt_fel', 'Tillräckligt?'],
];

export async function GET() {
  const supabase = createServerClient();
  const nu = Date.now();
  const gammal = (at: string) => nu - new Date(at).getTime() > GRACE_MS;

  const [profiler, felUnderlag, ejKontrollerade, mejlMedBilagor, inMejl, utkast, mejlFel, smsFel, bank, shopify, woo, zettle] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, company_name'),
    supabase.from('bokforing_underlag')
      .select('id, user_id, sender_email, file_name, created_at, kontroll_status, kontroll_at, varningar, definition_fel, transaktioner_fel, verifikationer_fel, komplettering_fel, dublettkoll_fel, tillrackligt_fel, transaktioner_utlasta_at, verifikationer_inlagda_at')
      .or('definition_fel.not.is.null,transaktioner_fel.not.is.null,verifikationer_fel.not.is.null,komplettering_fel.not.is.null,dublettkoll_fel.not.is.null,tillrackligt_fel.not.is.null,kontroll_status.eq.fel,varningar.not.is.null'),
    supabase.from('bokforing_underlag')
      .select('id, user_id, sender_email, file_name, mime_type, gmail_message_id, created_at, sortering, transaktioner_utlasta_at, verifikationer_inlagda_at, verifikationer_antal, verifikationer_fel')
      .eq('source', 'mejl').not('user_id', 'is', null).is('kontroll_at', null).gte('created_at', KONTROLL_SEDAN),
    supabase.from('mail_messages').select('gmail_message_id, from_email, subject, sent_at, attachment_names')
      .eq('direction', 'in').gte('sent_at', BILAGOR_SEDAN),
    supabase.from('mail_messages').select('gmail_message_id, from_email, subject, sent_at')
      .eq('direction', 'in').gte('sent_at', BEHANDLADE_SEDAN),
    supabase.from('mejl_utkast').select('id, till_email, amne, fel, created_at').eq('status', 'draft').not('fel', 'is', null),
    supabase.from('email_log').select('id, to_email, subject, error, created_at').eq('status', 'failed').is('issue_dismissed_at', null),
    supabase.from('sms_messages').select('id, phone, user_id, body, error, created_at').eq('direction', 'out').eq('status', 'failed').is('issue_dismissed_at', null),
    supabase.from('bank_kopplingar').select('session_id, user_id, aspsp_name, senaste_fel, senast_synkad_at').not('senaste_fel', 'is', null),
    supabase.from('shopify_butiker').select('shop, user_id, senaste_fel, senast_synkad_at').not('senaste_fel', 'is', null),
    supabase.from('woocommerce_butiker').select('url, user_id, senaste_fel, senast_synkad_at').not('senaste_fel', 'is', null),
    supabase.from('zettle_kopplingar').select('user_id, senaste_fel, senast_synkad_at').not('senaste_fel', 'is', null),
  ]);

  const varningar: Varning[] = [];

  // En tabell som inte gick att läsa är själv en varning — annars ser listan
  // tom och lugn ut fast den bara är ofullständig
  for (const [namn, res] of Object.entries({
    profiles: profiler, bokforing_underlag: felUnderlag, 'bokforing_underlag (fastnade)': ejKontrollerade, mail_messages: mejlMedBilagor,
    'mail_messages (obehandlade)': inMejl, mejl_utkast: utkast, email_log: mejlFel, sms_messages: smsFel,
    bank_kopplingar: bank, shopify_butiker: shopify, woocommerce_butiker: woo, zettle_kopplingar: zettle,
  })) {
    if (res.error) varningar.push({ id: `tabell:${namn}`, allvar: 'fel', kategori: 'Varningarna', titel: `Kunde inte läsa ${namn}`, detalj: res.error.message, at: new Date().toISOString() });
  }

  const profil = new Map((profiler.data ?? []).map((p) => [p.id as string, p]));
  const vem = (userId: string | null | undefined, email?: string | null) => {
    const p = userId ? profil.get(userId) : undefined;
    return {
      person: p?.email || email || userId || undefined,
      personNamn: p?.full_name?.trim() || p?.company_name?.trim() || p?.email || email || undefined,
    };
  };

  // ── Underlag där ett steg sparat ett fel, eller som har varningar ──
  for (const u of felUnderlag.data ?? []) {
    const rad = u as Record<string, unknown> & { id: string; user_id: string | null; sender_email: string | null; file_name: string; created_at: string };
    for (const [kolumn, steg] of STEG) {
      const fel = rad[kolumn];
      if (typeof fel === 'string' && fel) {
        varningar.push({
          id: `steg:${u.id}:${kolumn}`, allvar: 'fel', kategori: 'Underlag', titel: `${steg} misslyckades: ${u.file_name}`,
          detalj: fel, at: u.created_at, ...vem(u.user_id, u.sender_email),
        });
      }
    }
    if (u.kontroll_status === 'fel') {
      varningar.push({
        id: `kontroll:${u.id}`, allvar: 'fel', kategori: 'Underlag', titel: `Underlagskontrollen kunde inte läsa ${u.file_name}`,
        at: u.kontroll_at ?? u.created_at, ...vem(u.user_id, u.sender_email),
      });
    }
    const lista = Array.isArray(u.varningar) ? (u.varningar as string[]) : [];
    if (lista.length) {
      varningar.push({
        id: `varningar:${u.id}`, allvar: 'varning', kategori: 'Underlag',
        titel: `${lista.length} ${lista.length === 1 ? 'rad' : 'rader'} sorterades bort eller gick inte att tolka: ${u.file_name}`,
        detalj: lista.join('\n'), at: u.created_at, ...vem(u.user_id, u.sender_email),
      });
    }
  }

  // ── Mejlade underlag som fastnat: aldrig utlästa, eller utlästa men aldrig kontrollerade ──
  // En rad per person och läge, med alla filerna i detaljen — ett mejl med
  // femtio kvitton ska inte bli femtio rader
  const fastnade = new Map<string, Varning & { filer: string[] }>();
  for (const u of ejKontrollerade.data ?? []) {
    if (!gammal(u.created_at) || u.sortering === 'ovrigt' || arVarAdress(u.sender_email)) continue;
    if (!kanLasasAvAi(u.file_name, u.mime_type) || isSieFile(u.file_name)) continue;
    // Ett bokfört underlag (kassarapport, SIE) kontrolleras inte — det har allt
    if (u.verifikationer_inlagda_at && !u.verifikationer_fel && (u.verifikationer_antal ?? 0) > 0) continue;
    const last = !!u.transaktioner_utlasta_at || !!u.verifikationer_inlagda_at;
    const nyckel = `${u.user_id}:${last}`;
    const rad = fastnade.get(nyckel) ?? {
      id: `fastnat:${nyckel}`, allvar: 'fel' as const, kategori: 'Underlag', titel: '', detalj: '', filer: [] as string[],
      at: u.created_at, ...vem(u.user_id, u.sender_email),
    };
    rad.filer.push(`${u.file_name} (${u.created_at.slice(0, 10)})`);
    if (u.created_at > rad.at) rad.at = u.created_at;
    rad.titel = last
      ? `${rad.filer.length} underlag utlästa men aldrig kontrollerade`
      : `${rad.filer.length} underlag aldrig utlästa`;
    rad.detalj = `Underlagsflödet avbröts på vägen, och inget utkast har skrivits om filerna: ${rad.filer.join(', ')}`;
    fastnade.set(nyckel, rad);
  }
  for (const { filer: _filer, ...v } of fastnade.values()) varningar.push(v);

  // ── Mejl med bilagor där filerna inte finns bland underlagen ──
  // Matchar på mejlets id, och på avsändare + filnamn för filer som lagts in
  // för hand (de har inget mejl-id)
  const sparade = new Set<string>();
  const harFil = (msgId: string, email: string, namn: string) => sparade.has(`m:${msgId}|${namn}`) || sparade.has(`e:${email.toLowerCase()}|${namn}`);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('bokforing_underlag').select('gmail_message_id, sender_email, user_id, file_name')
      .gte('created_at', BILAGOR_SEDAN).order('created_at').range(from, from + 999);
    if (error) {
      varningar.push({ id: 'tabell:bilagor', allvar: 'fel', kategori: 'Varningarna', titel: 'Kunde inte jämföra bilagor mot underlag', detalj: error.message, at: new Date().toISOString() });
      break;
    }
    for (const r of data ?? []) {
      if (r.gmail_message_id) sparade.add(`m:${r.gmail_message_id}|${r.file_name}`);
      for (const e of [r.sender_email, r.user_id ? profil.get(r.user_id)?.email : null]) if (e) sparade.add(`e:${String(e).toLowerCase()}|${r.file_name}`);
    }
    if ((data ?? []).length < 1000) break;
  }
  for (const m of mejlMedBilagor.data ?? []) {
    if (!gammal(m.sent_at)) continue;
    const saknas = ((m.attachment_names ?? []) as string[]).filter((n) => !harFil(m.gmail_message_id, m.from_email ?? '', n));
    if (!saknas.length) continue;
    varningar.push({
      id: `bilagor:${m.gmail_message_id}`, allvar: 'fel', kategori: 'Mejl',
      titel: `${saknas.length} ${saknas.length === 1 ? 'bilaga' : 'bilagor'} sparades aldrig: ${m.subject || '(inget ämne)'}`,
      detalj: saknas.join(', '), at: m.sent_at, person: m.from_email, personNamn: m.from_email,
    });
  }

  // ── Mejl som check-inbox aldrig tagit hand om ──
  const klara = new Set<string>();
  const inIds = (inMejl.data ?? []).map((m) => m.gmail_message_id as string);
  let kundeLasa = true;
  for (let i = 0; i < inIds.length; i += 200) {
    const { data, error } = await supabase.from('inmail_behandlade').select('gmail_message_id').in('gmail_message_id', inIds.slice(i, i + 200));
    if (error) {
      kundeLasa = false;
      varningar.push({ id: 'tabell:behandlade', allvar: 'fel', kategori: 'Varningarna', titel: 'Kunde inte läsa inmail_behandlade', detalj: error.message, at: new Date().toISOString() });
      break;
    }
    for (const r of data ?? []) klara.add(r.gmail_message_id as string);
  }
  if (kundeLasa) {
    for (const m of inMejl.data ?? []) {
      if (klara.has(m.gmail_message_id) || !gammal(m.sent_at)) continue;
      varningar.push({
        id: `obehandlat:${m.gmail_message_id}`, allvar: 'fel', kategori: 'Mejl',
        titel: `Mejlet har inte gått genom flödet: ${m.subject || '(inget ämne)'}`,
        detalj: 'check-inbox har inte tagit hand om mejlet. Kör skriptet, eller kolla Körningar i Apps Script.',
        at: m.sent_at, person: m.from_email, personNamn: m.from_email,
      });
    }
  }

  // ── Utkast där flödet misslyckades ──
  for (const u of utkast.data ?? []) {
    varningar.push({
      id: `utkast:${u.id}`, allvar: 'fel', kategori: 'Inkorgen', titel: `Utkast skrivet utan kontroll: ${u.amne || '(inget ämne)'}`,
      detalj: u.fel ?? undefined, at: u.created_at, person: u.till_email, personNamn: u.till_email,
    });
  }

  // ── Utskick som inte gick fram ──
  for (const r of mejlFel.data ?? []) {
    varningar.push({
      id: `mejl:${r.id}`, allvar: 'fel', kategori: 'Utskick', titel: `Mejl gick inte fram: ${r.subject || '(inget ämne)'}`,
      detalj: explainError('mejl', r.error), at: r.created_at, person: r.to_email, personNamn: r.to_email,
      utskick: { channel: 'mejl', id: r.id },
    });
  }
  for (const r of smsFel.data ?? []) {
    varningar.push({
      id: `sms:${r.id}`, allvar: 'fel', kategori: 'Utskick', titel: `SMS gick inte fram till ${r.phone}`,
      detalj: explainError('sms', r.error), at: r.created_at, ...vem(r.user_id, r.phone),
      utskick: { channel: 'sms', id: r.id },
    });
  }

  // ── Kopplingar som slutat synka ──
  const koppling = (typ: string, rader: { user_id: string | null; senaste_fel: string | null; senast_synkad_at: string | null }[] | null, namn: (r: Record<string, unknown>) => string) => {
    for (const r of rader ?? []) {
      varningar.push({
        id: `${typ}:${r.user_id}:${namn(r)}`, allvar: 'fel', kategori: 'Kopplingar', titel: `${typ}: ${namn(r)}`,
        detalj: r.senaste_fel ?? undefined, at: r.senast_synkad_at ?? new Date().toISOString(), ...vem(r.user_id),
      });
    }
  };
  koppling('Bank', bank.data, (r) => String(r.aspsp_name ?? 'bank'));
  koppling('Shopify', shopify.data, (r) => String(r.shop ?? 'butik'));
  koppling('WooCommerce', woo.data, (r) => String(r.url ?? 'butik'));
  koppling('Zettle', zettle.data, () => 'kassa');

  varningar.sort((a, b) => (a.allvar === b.allvar ? b.at.localeCompare(a.at) : a.allvar === 'fel' ? -1 : 1));
  return NextResponse.json({ varningar });
}
