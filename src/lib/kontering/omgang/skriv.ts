import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FLYTTAD_FOR_HAND } from '@/lib/underlag/sortering';
import { valjKonto } from '../kontera';
import { bokforForfallna } from '../preliminar';
import { MODELL } from './anrop';
import type { Filpost } from './forbered';
import type { Resultat, ResultatFil, ResultatTransaktion } from './svar';

/**
 * Flödets svar skrivs till bokföringen: underlagens transaktioner ersätts med
 * de nya, och varje transaktion får sin kontering. En grön kontering blir
 * verifikation direkt (../preliminar), en gul när byrån godkänt den eller valt
 * konto i Kontering, en röd bokförs inte. Det som saknas frågas efter i kl
 * 18-mejlet (Skriv mail).
 *
 * Verifikationerna Flöde gjort hör till transaktionerna och försvinner med dem
 * när filen körs om. Ett underlag med verifikationer som inte kommer från en
 * transaktion (inläst SIE, Plocka verif för en kassarapport) rörs inte.
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
    supabase.from('transaktioner').select('id, underlag_id, datum, belopp, valuta, riktning, motpart, beskrivning, fraga_utkast_id').in('underlag_id', ids),
    // Bara verifikationer som inte kommer från en transaktion — Flödes egna ersätts med transaktionerna
    supabase.from('verifikationer').select('underlag_id').in('underlag_id', ids).is('transaktion_id', null),
  ]);
  if (uFel ?? tFel ?? vFel) throw new Error(`Kunde inte läsa underlagen: ${(uFel ?? tFel ?? vFel)!.message}`);
  const gamlaIds = (gamla ?? []).map((t) => t.id as string);
  const bokfordaUnderlag = new Set((verUnderlag ?? []).map((v) => v.underlag_id as string));
  const rader = new Map(((underlag ?? []) as UnderlagRad[]).map((u) => [u.id, u]));

  // En dubblett kan peka på en transaktion som ersatts — av en annan fil i samma
  // körning, eller en annan del av den. Då står dubbletten som text i stället.
  const refIds = [...new Set(resultat.filer.flatMap((f) => f.transaktioner).map((t) => t.dublett.transaktionId).filter((x): x is string => !!x))];
  const { data: finns } = refIds.length ? await supabase.from('transaktioner').select('id').in('id', refIds) : { data: [] };
  const finnsKvar = new Set((finns ?? []).map((t) => t.id as string));
  for (const t of resultat.filer.flatMap((f) => f.transaktioner)) {
    if (t.dublett.transaktionId && !finnsKvar.has(t.dublett.transaktionId)) t.dublett.transaktionId = null;
  }

  // Kopplingar från andra filer till transaktioner som ersätts nu försvinner med
  // dem. De läses först och pekas om till de nya transaktionerna (pekaOm).
  const inkommande: Koppling[] = [];
  for (let i = 0; i < gamlaIds.length; i += 200) {
    const { data, error } = await supabase.from('underlag_kopplingar')
      .select('user_id, underlag_id, transaktion_id, datum, belopp, motivering').in('transaktion_id', gamlaIds.slice(i, i + 200));
    if (error) throw new Error(`Kunde inte läsa kopplingarna: ${error.message}`);
    inkommande.push(...((data ?? []) as Koppling[]));
  }

  const skrivs = (f: ResultatFil) => {
    const u = rader.get(f.underlagId);
    return !!u && u.user_id === userId && !bokfordaUnderlag.has(f.underlagId) && !f.delAv && (f.sort === 'underlag' || f.sort === 'komplement');
  };
  const kopplingar = planeraKopplingar(resultat, skrivs);
  const skrivna = new Set<string>();

  for (const f of resultat.filer) {
    const u = rader.get(f.underlagId);
    try {
      if (!u) { f.skrivet = 'Underlaget finns inte längre — inget skrevs.'; continue; }
      if (u.user_id !== userId) { f.skrivet = 'Underlaget hör till en annan kund — inget skrevs.'; continue; }
      if (bokfordaUnderlag.has(f.underlagId)) { f.skrivet = 'Filens verifikationer är inlästa (SIE eller Plocka verif) — den rördes inte.'; continue; }
      if (!f.sort) { f.skrivet = 'Inget svar — filen rördes inte. Kör den igen.'; continue; }
      if (f.sort === 'verifikationer') {
        // Lästs i Flöde, så att Kör Flöde inte skickar den igen
        await supabase.from('bokforing_underlag').update({ flode_at: DAGS() }).eq('id', f.underlagId);
        f.skrivet = 'Redan bokfört underlag — läs in verifikationerna med Plocka verif i flödesschemat.';
        continue;
      }
      const deras = (gamla ?? []).filter((t) => t.underlag_id === f.underlagId);
      await sparaInstruktioner(supabase, f.underlagId, deras);
      // Filens egna kopplingar görs om från svaret
      const { error: kFel } = await supabase.from('underlag_kopplingar').delete().eq('underlag_id', f.underlagId);
      if (kFel) throw new Error(`Kunde inte ta bort filens gamla kopplingar: ${kFel.message}`);
      // Verifikationerna Flöde gjort förut följer med (on delete cascade)
      const { error: dFel } = await supabase.from('transaktioner').delete().eq('underlag_id', f.underlagId);
      if (dFel) throw new Error(`Kunde inte ta bort de gamla transaktionerna: ${dFel.message}`);
      // Har kunden redan fått frågor om filen frågas inte samma sak igen
      const fragad = deras.find((t) => t.fraga_utkast_id)?.fraga_utkast_id ?? null;
      f.skrivet = await skrivFil(supabase, u, f, perFil, fragad, kopplingar);
      skrivna.add(f.underlagId);
    } catch (err) {
      f.skrivet = `Fel: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  await kopplaUnderlag(supabase, userId, resultat, kopplingar, skrivna);
  await pekaOm(supabase, resultat, inkommande, gamla ?? [], kopplingar, skrivna);

  // De gröna bokförs direkt
  for (const f of resultat.filer) {
    if (!skrivna.has(f.underlagId)) continue;
    try {
      const { bokforda, fel } = await bokforForfallna(supabase, { userId, underlagId: f.underlagId, nu: true });
      const delar = [bokforda ? `${bokforda} bokförd${bokforda === 1 ? '' : 'a'}.` : '', ...fel.map((x) => `Kunde inte bokföras: ${x}`)].filter(Boolean);
      if (delar.length) f.skrivet = [f.skrivet, ...delar].filter(Boolean).join(' ');
    } catch (err) {
      f.skrivet = `${f.skrivet ?? ''} Kunde inte bokföras: ${err instanceof Error ? err.message : String(err)}`.trim();
    }
  }
}

interface Mal { transaktion_id?: string; verifikation_id?: string; malFil?: string }
interface Koppling { user_id: string; underlag_id: string; transaktion_id: string | null; datum: string | null; belopp: number | null; motivering: string | null }

/**
 * En säker dubblett är samma affär som något som redan finns — kvittot till en
 * kontoutdragsrad, en verifikation i SIE. Den blir ingen egen transaktion; filen
 * kopplas dit som ett extra underlag. Det som pekas ut avgörs här, innan något
 * skrivs, och transaktionerna som ska skrivas får sina id redan nu så att en
 * rad i en annan fil i körningen kan pekas på.
 *
 * Går dubbletten inte att peka ut — en fil i ett annat anrop, en rad som
 * ersatts — sparas den som förut: en transaktion som inte bokförs.
 */
function planeraKopplingar(resultat: Resultat, skrivs: (f: ResultatFil) => boolean): Map<ResultatTransaktion, Mal> {
  const mal = new Map<ResultatTransaktion, Mal>();
  const filer = resultat.filer.filter(skrivs);
  for (const f of filer) {
    for (const t of f.transaktioner) {
      if (t.dublett.status !== 'dublett') continue;
      if (t.dublett.transaktionId) mal.set(t, { transaktion_id: t.dublett.transaktionId });
      else if (t.dublett.verifikationId) mal.set(t, { verifikation_id: t.dublett.verifikationId });
    }
  }
  for (const f of filer) for (const t of f.transaktioner) if (!mal.has(t)) t.transaktionId = randomUUID();

  // En annan fil i samma körning: raden med samma belopp, eller filens enda rad
  const perNr = new Map(filer.map((f) => [f.fil.toUpperCase(), f]));
  for (const f of filer) {
    for (const t of f.transaktioner) {
      if (t.dublett.status !== 'dublett' || mal.has(t)) continue;
      const malFil = perNr.get(t.dublett.ref.trim().toUpperCase());
      if (!malFil || malFil === f) continue;
      const kandidater = malFil.transaktioner.filter((x) => !mal.has(x) && x.dublett.status !== 'dublett' && x.transaktionId);
      const vald = kandidater.find((x) => Math.abs(x.belopp - t.belopp) < 1 && x.riktning === t.riktning)
        ?? (kandidater.length === 1 ? kandidater[0] : undefined);
      if (!vald) continue;
      mal.set(t, { transaktion_id: vald.transaktionId, malFil: malFil.underlagId });
      t.transaktionId = undefined;
    }
  }
  return mal;
}

/** Sparar kopplingarna för filerna som skrevs. */
async function kopplaUnderlag(
  supabase: SupabaseClient, userId: string, resultat: Resultat,
  kopplingar: Map<ResultatTransaktion, Mal>, skrivna: Set<string>,
) {
  for (const f of resultat.filer) {
    if (!skrivna.has(f.underlagId)) continue;
    const rader = new Map<string, Record<string, unknown>>();
    for (const t of f.transaktioner) {
      const m = kopplingar.get(t);
      if (!m) continue;
      // Pekar den på en rad i en fil som inte skrevs finns raden inte
      if (m.malFil && !skrivna.has(m.malFil)) { t.kopplad = `Kunde inte kopplas — ${t.dublett.refText || 'raden'} skrevs inte.`; continue; }
      const nyckel = m.transaktion_id ?? `v${m.verifikation_id}`;
      rader.set(nyckel, {
        user_id: userId, underlag_id: f.underlagId,
        transaktion_id: m.transaktion_id ?? null, verifikation_id: m.verifikation_id ?? null,
        datum: t.datum, belopp: t.belopp, motivering: t.dublett.motivering || null,
      });
      t.kopplad = `Kopplad till ${t.dublett.refText || (m.verifikation_id ? 'en bokförd verifikation' : 'en befintlig transaktion')} som extra underlag.`;
    }
    if (!rader.size) continue;
    const { error } = await supabase.from('underlag_kopplingar').insert([...rader.values()]);
    if (error) f.skrivet = `${f.skrivet ?? ''} Kopplingarna kunde inte sparas: ${error.message}`.trim();
  }
}

/**
 * Kopplingar från andra filer till en transaktion som ersattes pekas om till
 * den nya transaktionen ur samma fil med samma belopp och riktning. Filer som
 * själva skrevs om i körningen har redan fått nya kopplingar.
 */
async function pekaOm(
  supabase: SupabaseClient, resultat: Resultat, inkommande: Koppling[],
  gamla: { id: string; underlag_id: string; datum: string | null; belopp: number; riktning?: string | null }[],
  kopplingar: Map<ResultatTransaktion, Mal>, skrivna: Set<string>,
) {
  const rader: Record<string, unknown>[] = [];
  for (const k of inkommande) {
    if (skrivna.has(k.underlag_id)) continue;
    const g = gamla.find((x) => x.id === k.transaktion_id);
    if (!g || !skrivna.has(g.underlag_id)) continue;
    const nya = (resultat.filer.find((f) => f.underlagId === g.underlag_id)?.transaktioner ?? [])
      .filter((t) => t.transaktionId && !kopplingar.has(t) && Math.abs(t.belopp - Number(g.belopp)) < 1 && t.riktning === g.riktning);
    const ny = nya.find((t) => t.datum === g.datum) ?? nya[0];
    if (!ny) continue;
    rader.push({ ...k, transaktion_id: ny.transaktionId });
  }
  if (rader.length) {
    const { error } = await supabase.from('underlag_kopplingar').insert(rader);
    if (error) console.error('[flode] kunde inte peka om kopplingarna:', error.message);
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
  kopplingar: Map<ResultatTransaktion, Mal>,
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

  // Bara det som inte har med bokföringen att göra går till övriga filer. Ett
  // komplement (kontoutdrag, skattekontoutdrag, rapporter) stannar bland underlagen.
  if (f.sort !== 'underlag' && f.sort !== 'komplement') {
    const vad = f.vad || 'Inget underlag för bokföringen';
    if (handsorterad) {
      await uppdatera(supabase, u.id, { ...tom, del_av: null, transaktioner_notering: vad, transaktioner_fel: `AI:n hittade inga transaktioner — den tror att filen är ${vad}` });
      return `Ligger bland underlagen för hand, men AI:n tror att det är ${vad.toLowerCase()} — inga transaktioner.`;
    }
    await uppdatera(supabase, u.id, { ...tom, del_av: null, sortering: 'ovrigt', sortering_orsak: vad, sortering_at: nu, transaktioner_notering: vad });
    return `Sorterad till övriga filer (${vad}).`;
  }

  const email = u.sender_email?.trim().toLowerCase() || null;
  // Det som är samma affär som något som redan finns kopplas dit efteråt (kopplaUnderlag)
  const kopplade = f.transaktioner.filter((t) => kopplingar.has(t)).length;
  const nya = f.transaktioner.filter((t) => !kopplingar.has(t)).map((t) => ({ t, id: t.transaktionId ?? randomUUID() }));
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
    ...(handsorterad ? {} : { sortering: 'underlag', sortering_orsak: f.sort === 'komplement' ? 'Komplement (Flöde)' : 'Läst av Flöde', sortering_at: nu }),
    del_av: null,
    transaktioner_antal: rows.length,
    transaktioner_notering: f.vad || null,
    // Ett komplement behöver inte ha egna transaktioner
    transaktioner_fel: rows.length || kopplade || f.sort === 'komplement' ? null : 'AI:n hittade inga transaktioner i filen',
  });
  const delar = [
    rows.length ? `${rows.length} ${rows.length === 1 ? 'transaktion sparad' : 'transaktioner sparade'}` : '',
    kopplade ? `${kopplade} kopplad${kopplade === 1 ? '' : 'e'} till det som redan fanns` : '',
  ].filter(Boolean);
  return delar.length ? `${delar.join(', ')}.` : f.sort === 'komplement' ? 'Komplement utan egna transaktioner.' : 'Inga transaktioner i filen.';
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
 * kontot i Kontering. Den blir verifikation direkt. Ångra tar bort
 * verifikationen och valet, och då väntar transaktionen på granskning igen.
 */
export async function godkannTransaktion(supabase: SupabaseClient, userId: string, t: ResultatTransaktion, godkand: boolean): Promise<void> {
  if (!t.transaktionId) throw new Error('Transaktionen sparades inte i bokföringen — se filens rad');
  if (!godkand) {
    const { error: vFel } = await supabase.from('verifikationer').delete().eq('transaktion_id', t.transaktionId).eq('user_id', userId).eq('kalla', 'ai');
    if (vFel) throw new Error(`Kunde inte ta bort verifikationen: ${vFel.message}`);
    const { error } = await supabase.from('transaktioner').update({ vald_kontering: null, preliminar_at: DAGS() }).eq('id', t.transaktionId).eq('user_id', userId);
    if (error) throw new Error(`Kunde inte ångra: ${error.message}`);
    return;
  }
  const k = t.kontering;
  if (!k?.konto) throw new Error('Konteringen har inget konto');
  await valjKonto(supabase, userId, t.transaktionId, k.konto, Number(k.momssats) || 0, undefined, k.momsdelar, k.omvand);
}
