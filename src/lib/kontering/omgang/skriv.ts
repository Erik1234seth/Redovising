import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FLYTTAD_FOR_HAND } from '@/lib/underlag/sortering';
import { valjKonto } from '../kontera';
import { MODELL } from './anrop';
import type { Filpost } from './forbered';
import type { Resultat, ResultatFil, ResultatTransaktion } from './svar';

/**
 * Flödets svar skrivs till bokföringen: underlagens transaktioner ersätts med
 * de nya, och varje transaktion får sin kontering. Därifrån är det som förut —
 * en grön kontering blir verifikation efter 14 dagar (../preliminar), en gul
 * väntar tills byrån godkänt den eller valt konto i Kontering, en röd bokförs
 * inte. Det som saknas frågas efter i kl 18-mejlet (Skriv mail).
 *
 * Ett underlag med något bokfört rörs inte: att ersätta transaktionerna skulle
 * ta bort verifikationerna med dem. Ett redan bokfört underlag (kassarapport)
 * läses in med Plocka verif i flödesschemat, som förut.
 */

const DAGS = () => new Date().toISOString();

interface UnderlagRad {
  id: string;
  user_id: string | null;
  sender_email: string | null;
  sortering: string | null;
  sortering_orsak: string | null;
}

/** Skriver svaret. Varje fil får `skrivet` — vad som hände med den — och varje transaktion sitt id. */
export async function skrivResultat(supabase: SupabaseClient, userId: string, filer: Filpost[], resultat: Resultat): Promise<void> {
  const ids = resultat.filer.map((f) => f.underlagId);
  if (!ids.length) return;
  const perFil = new Map(filer.map((f) => [f.fil.toUpperCase(), f]));

  const [{ data: underlag, error: uFel }, { data: gamla, error: tFel }, { data: verUnderlag, error: vFel }] = await Promise.all([
    supabase.from('bokforing_underlag').select('id, user_id, sender_email, sortering, sortering_orsak').in('id', ids),
    supabase.from('transaktioner').select('id, underlag_id, datum, belopp, valuta, motpart, beskrivning, fraga_utkast_id').in('underlag_id', ids),
    supabase.from('verifikationer').select('underlag_id').in('underlag_id', ids),
  ]);
  if (uFel ?? tFel ?? vFel) throw new Error(`Kunde inte läsa underlagen: ${(uFel ?? tFel ?? vFel)!.message}`);
  const gamlaIds = (gamla ?? []).map((t) => t.id as string);
  const { data: verTx, error: vtFel } = gamlaIds.length
    ? await supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', gamlaIds)
    : { data: [], error: null };
  if (vtFel) throw new Error(`Kunde inte läsa verifikationerna: ${vtFel.message}`);
  const bokfordTx = new Set((verTx ?? []).map((v) => v.transaktion_id as string));
  const bokfordaUnderlag = new Set([
    ...(verUnderlag ?? []).map((v) => v.underlag_id as string),
    ...(gamla ?? []).filter((t) => bokfordTx.has(t.id)).map((t) => t.underlag_id as string),
  ]);
  const rader = new Map(((underlag ?? []) as UnderlagRad[]).map((u) => [u.id, u]));

  // En dubblett kan peka på en transaktion som ersatts — av en annan fil i samma
  // körning, eller en annan del av den. Då står dubbletten som text i stället.
  const refIds = [...new Set(resultat.filer.flatMap((f) => f.transaktioner).map((t) => t.dublett.transaktionId).filter((x): x is string => !!x))];
  const { data: finns } = refIds.length ? await supabase.from('transaktioner').select('id').in('id', refIds) : { data: [] };
  const finnsKvar = new Set((finns ?? []).map((t) => t.id as string));
  for (const t of resultat.filer.flatMap((f) => f.transaktioner)) {
    if (t.dublett.transaktionId && !finnsKvar.has(t.dublett.transaktionId)) t.dublett.transaktionId = null;
  }

  for (const f of resultat.filer) {
    const u = rader.get(f.underlagId);
    try {
      if (!u) { f.skrivet = 'Underlaget finns inte längre — inget skrevs.'; continue; }
      if (u.user_id !== userId) { f.skrivet = 'Underlaget hör till en annan kund — inget skrevs.'; continue; }
      if (bokfordaUnderlag.has(f.underlagId)) { f.skrivet = 'Något är redan bokfört från filen — den rördes inte. Ångra bokföringen i Kontering om den ska göras om.'; continue; }
      if (!f.sort) { f.skrivet = 'Inget svar — filen rördes inte. Kör den igen.'; continue; }
      if (f.sort === 'verifikationer') {
        // Lästs i Flöde, så att Kör Flöde inte skickar den igen
        await supabase.from('bokforing_underlag').update({ flode_at: DAGS() }).eq('id', f.underlagId);
        f.skrivet = 'Redan bokfört underlag — läs in verifikationerna med Plocka verif i flödesschemat.';
        continue;
      }
      const deras = (gamla ?? []).filter((t) => t.underlag_id === f.underlagId);
      await sparaInstruktioner(supabase, f.underlagId, deras);
      const { error: dFel } = await supabase.from('transaktioner').delete().eq('underlag_id', f.underlagId);
      if (dFel) throw new Error(`Kunde inte ta bort de gamla transaktionerna: ${dFel.message}`);
      // Har kunden redan fått frågor om filen frågas inte samma sak igen
      const fragad = deras.find((t) => t.fraga_utkast_id)?.fraga_utkast_id ?? null;
      f.skrivet = await skrivFil(supabase, u, f, perFil, fragad);
    } catch (err) {
      f.skrivet = `Fel: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}

/**
 * Byråns kontext på en enskild transaktion skulle försvinna med den. Den
 * flyttas till filen, med vilken transaktion den gällde, så att den följer med
 * nästa gång filen körs.
 */
async function sparaInstruktioner(
  supabase: SupabaseClient,
  underlagId: string,
  gamla: { id: string; datum: string | null; belopp: number; valuta: string | null; motpart: string | null; beskrivning: string | null }[],
) {
  if (!gamla.length) return;
  const { data } = await supabase.from('flodes_instruktioner').select('id, transaktion_id, text').eq('omfang', 'transaktion').in('transaktion_id', gamla.map((t) => t.id));
  for (const i of data ?? []) {
    const t = gamla.find((x) => x.id === i.transaktion_id);
    const vilken = t ? `${t.datum ?? 'okänt datum'} ${Number(t.belopp)} ${t.valuta || 'SEK'} ${t.motpart || t.beskrivning || ''}`.trim() : 'en transaktion i filen';
    await supabase.from('flodes_instruktioner').update({
      omfang: 'underlag', underlag_id: underlagId, transaktion_id: null, text: `Gäller transaktionen ${vilken}: ${i.text}`,
    }).eq('id', i.id);
  }
}

async function skrivFil(
  supabase: SupabaseClient,
  u: UnderlagRad,
  f: ResultatFil,
  perFil: Map<string, Filpost>,
  fragad: string | null,
): Promise<string> {
  const nu = DAGS();
  const handsorterad = u.sortering_orsak === FLYTTAD_FOR_HAND && u.sortering === 'underlag';
  const tom = { transaktioner_utlasta_at: nu, transaktioner_antal: 0, transaktioner_fel: null, varningar: null, flode_at: nu };

  // En sida läses med dokumentets första sida
  if (f.delAv) {
    const huvud = perFil.get(f.delAv);
    if (!huvud) return 'Sidan pekar på en fil som inte fanns i körningen — inget skrevs.';
    await uppdatera(supabase, u.id, { ...tom, del_av: huvud.underlagId, transaktioner_notering: `Sida i ${huvud.namn}` });
    return `Sida i ${huvud.namn}.`;
  }

  // Ett kontoutdrag med transaktioner skrivs som ett underlag; utan går det till övriga filer
  if (f.sort !== 'underlag' && !(f.sort === 'kontoutdrag' && f.transaktioner.length)) {
    const vad = f.vad || (f.sort === 'kontoutdrag' ? 'Kontoutdrag' : 'Inget underlag för bokföringen');
    if (handsorterad) {
      await uppdatera(supabase, u.id, { ...tom, del_av: null, transaktioner_notering: vad, transaktioner_fel: `AI:n hittade inga transaktioner — den tror att filen är ${vad}` });
      return `Ligger bland underlagen för hand, men AI:n tror att det är ${vad.toLowerCase()} — inga transaktioner.`;
    }
    await uppdatera(supabase, u.id, { ...tom, del_av: null, sortering: 'ovrigt', sortering_orsak: vad, sortering_at: nu, transaktioner_notering: vad });
    return `Sorterad till övriga filer (${vad}).`;
  }

  const email = u.sender_email?.trim().toLowerCase() || null;
  const nya = f.transaktioner.map((t) => ({ t, id: randomUUID() }));
  const rows = nya.map(({ t, id }) => transaktionsrad(t, id, u, email, fragad, nu));
  if (rows.length) {
    const { error } = await supabase.from('transaktioner').insert(rows);
    if (error) throw new Error(`Kunde inte spara transaktionerna: ${error.message}`);
  }
  const konteringar = nya.filter(({ t }) => t.kontering).map(({ t, id }) => ({
    transaktion_id: id,
    user_id: u.user_id,
    modell: MODELL,
    konto: t.kontering!.konto,
    momssats: t.kontering!.momssats,
    momsdelar: t.kontering!.momsdelar,
    omvand: t.kontering!.omvand,
    motivering: t.kontering!.motivering,
    regler: t.kontering!.regler,
    granskning: { ...(t.kontering!.granskning ?? {}), sakerhet: t.kontering!.sakerhet, svarade: MODELL, flode: true },
    flaggor: t.kontering!.flaggor,
    omdome: t.kontering!.omdome,
    created_at: nu,
  }));
  if (konteringar.length) {
    const { error } = await supabase.from('konteringar').insert(konteringar);
    if (error) {
      await supabase.from('transaktioner').delete().eq('underlag_id', u.id);
      throw new Error(`Kunde inte spara konteringarna: ${error.message}`);
    }
  }
  for (const { t, id } of nya) t.transaktionId = id;

  await uppdatera(supabase, u.id, {
    ...tom,
    ...(handsorterad ? {} : { sortering: 'underlag', sortering_orsak: 'Läst av Flöde', sortering_at: nu }),
    del_av: null,
    transaktioner_antal: rows.length,
    transaktioner_notering: f.vad || null,
    transaktioner_fel: rows.length ? null : 'AI:n hittade inga transaktioner i filen',
  });
  return rows.length ? `${rows.length} ${rows.length === 1 ? 'transaktion sparad' : 'transaktioner sparade'}.` : 'Inga transaktioner i filen.';
}

function transaktionsrad(t: ResultatTransaktion, id: string, u: UnderlagRad, email: string | null, fragad: string | null, nu: string) {
  const d = t.dublett;
  // En dubblett bokförs inte, och då ska kunden inte heller få frågor om den
  const saknas = d.status === 'dublett' ? [] : t.saknas;
  return {
    id,
    user_id: u.user_id,
    customer_email: email,
    underlag_id: u.id,
    radnr: t.nr,
    datum: t.datum,
    beskrivning: t.beskrivning || null,
    motpart: t.motpart || null,
    belopp: t.belopp,
    moms: t.moms || null,
    valuta: t.valuta || 'SEK',
    riktning: t.riktning,
    anteckning: t.anteckning || null,
    vat_nummer: t.vat_nummer || null,
    uppgifter: t.uppgifter,
    kronor: t.kronor,
    kalla: 'ai',
    modell: MODELL,
    dublettkoll: { status: d.status, av: d.transaktionId, avFil: d.status === 'unik' ? null : d.refText || null, motivering: d.motivering, modell: MODELL },
    // En dubblett av en transaktion pekar på den. En dubblett av en hel fil har ingen rad att peka på.
    dublett_av: d.status === 'dublett' ? d.transaktionId : null,
    // Orsaken står alltid: pekar dublett_av på en rad som senare ersätts blir den null, och då ska raden ändå inte bokföras
    dublett_orsak: d.status === 'dublett' ? `Dubblett av ${d.refText || 'ett annat underlag'}` : null,
    tillrackligt: { status: saknas.length ? 'saknar' : 'tillrackligt', saknas, antaganden: t.antaganden, modell: MODELL },
    fraga_utkast_id: saknas.length ? fragad : null,
    preliminar_at: t.kontering ? nu : null,
  };
}

async function uppdatera(supabase: SupabaseClient, id: string, falt: Record<string, unknown>) {
  const { error } = await supabase.from('bokforing_underlag').update(falt).eq('id', id);
  if (error) throw new Error(`Kunde inte uppdatera underlaget: ${error.message}`);
}

/**
 * Byrån godkänner en gul kontering som den är — samma sak som att välja
 * kontot i Kontering. Den blir verifikation 14 dagar senare. Ångra tar bort
 * valet, och då väntar transaktionen på granskning igen.
 */
export async function godkannTransaktion(supabase: SupabaseClient, userId: string, t: ResultatTransaktion, godkand: boolean): Promise<void> {
  if (!t.transaktionId) throw new Error('Transaktionen sparades inte i bokföringen — se filens rad');
  const { count } = await supabase.from('verifikationer').select('id', { count: 'exact', head: true }).eq('transaktion_id', t.transaktionId);
  if (count) throw new Error('Transaktionen är redan bokförd — ångra bokföringen i Kontering först');
  if (!godkand) {
    const { error } = await supabase.from('transaktioner').update({ vald_kontering: null, preliminar_at: DAGS() }).eq('id', t.transaktionId).eq('user_id', userId);
    if (error) throw new Error(`Kunde inte ångra: ${error.message}`);
    return;
  }
  const k = t.kontering;
  if (!k?.konto) throw new Error('Konteringen har inget konto');
  await valjKonto(supabase, userId, t.transaktionId, k.konto, Number(k.momssats) || 0, undefined, k.momsdelar, k.omvand);
}
