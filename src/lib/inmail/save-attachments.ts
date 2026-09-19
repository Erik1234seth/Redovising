import type { SupabaseClient } from '@supabase/supabase-js';
import { isSieFile } from '@/lib/sie/parse';
import { importSieUnderlag } from '@/lib/sie/import';

/**
 * Sparar bilagorna i inkommande mejl som underlag — alla, oavsett filtyp.
 *
 * Ingenting tolkas här eller i mejlflödet i övrigt. Filerna sparas först och
 * tolkas i ett separat steg senare, så att inget kvitto går förlorat för att en
 * AI inte förstod det eller för att filtypen var oväntad.
 *
 * Två vägar in, samma resultat:
 *  - Apps Script (save-attachments.gs) laddar upp varje fil direkt till
 *    lagringen med en engångslänk: `prepareMailUpload` → PUT → `confirmMailUpload`.
 *    Filerna passerar aldrig Vercel, vars gräns på 4,5 MB per anrop annars
 *    stoppat allt större än ett par foton.
 *  - `saveMailAttachments` tar emot base64 i själva mejlanropet. Den finns kvar
 *    för en äldre scriptversion som skickar filerna så.
 *
 * Kopplingen går på avsändarens adress. Har adressen ett konto (direkt eller via
 * person_aliases) sätts user_id också, så att kunden ser underlaget. Dubbletter
 * stoppas på meddelande + filnamn + storlek, så båda vägarna kan köras på samma
 * mejl utan att något sparas två gånger.
 */

export const UNDERLAG_BUCKET = 'bokforing-underlag';

export interface MailFileInfo {
  senderEmail: string;
  messageId: string;
  fileName: string;
  size: number;
  mimeType?: string;
}

function normalize(info: MailFileInfo) {
  return {
    email: info.senderEmail.trim().toLowerCase(),
    messageId: info.messageId,
    fileName: info.fileName?.trim() || 'bilaga',
    size: info.size,
    mimeType: info.mimeType?.trim() || 'application/octet-stream',
  };
}

export async function resolveUserId(supabase: SupabaseClient, email: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  if (profile?.id) return profile.id;

  const { data: alias } = await supabase
    .from('person_aliases')
    .select('user_id')
    .eq('alias_email', email)
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle();
  return alias?.user_id ?? null;
}

/** Mappen följer kontot när det finns, annars adressen. */
export function folderFor(userId: string | null, email: string): string {
  return userId ?? `mejl/${email.replace(/[^a-z0-9.-]/g, '_')}`;
}

async function alreadySaved(supabase: SupabaseClient, messageId: string, fileName: string, size: number) {
  const { data, error } = await supabase
    .from('bokforing_underlag')
    .select('id')
    .eq('gmail_message_id', messageId)
    .eq('file_name', fileName)
    .eq('file_size', size)
    .limit(1);
  if (error) throw new Error(`Kunde inte läsa bokforing_underlag: ${error.message}`);
  return (data ?? []).length > 0;
}

function validate(info: MailFileInfo) {
  if (!info.senderEmail?.includes('@')) throw new Error('senderEmail krävs');
  if (!info.messageId) throw new Error('messageId krävs');
  if (!Number.isFinite(info.size) || info.size < 0) throw new Error('size krävs');
}

/** Steg 1: ger en engångslänk att ladda upp filen till, om den inte redan finns. */
export async function prepareMailUpload(
  supabase: SupabaseClient,
  raw: MailFileInfo,
): Promise<{ status: 'exists' } | { status: 'upload'; path: string; signedUrl: string }> {
  validate(raw);
  const info = normalize(raw);

  if (await alreadySaved(supabase, info.messageId, info.fileName, info.size)) return { status: 'exists' };

  const userId = await resolveUserId(supabase, info.email);
  const safeName = info.fileName.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60) || 'bilaga';
  const path = `${folderFor(userId, info.email)}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

  const { data, error } = await supabase.storage.from(UNDERLAG_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Kunde inte skapa uppladdningslänk: ${error?.message ?? 'okänt fel'}`);

  return { status: 'upload', path: data.path, signedUrl: data.signedUrl };
}

/** Steg 2: skriver raden när filen ligger i lagringen. */
export async function confirmMailUpload(
  supabase: SupabaseClient,
  raw: MailFileInfo & { path: string },
): Promise<{ status: 'saved' | 'exists' }> {
  validate(raw);
  const info = normalize(raw);
  const userId = await resolveUserId(supabase, info.email);

  // Sökvägen kommer från scriptet — den måste ligga i den mapp vi själva delade ut
  const folder = folderFor(userId, info.email);
  if (!raw.path?.startsWith(`${folder}/`)) throw new Error('path hör inte till avsändaren');

  // En rad som pekar på en fil som aldrig kom fram är värre än ingen rad
  const { error: missing } = await supabase.storage.from(UNDERLAG_BUCKET).createSignedUrl(raw.path, 60);
  if (missing) throw new Error(`Filen finns inte i lagringen: ${missing.message}`);

  return insertRow(supabase, userId, info, raw.path);
}

async function insertRow(
  supabase: SupabaseClient,
  userId: string | null,
  info: ReturnType<typeof normalize>,
  path: string,
): Promise<{ status: 'saved' | 'exists' }> {
  const { data: saved, error } = await supabase.from('bokforing_underlag').insert({
    user_id: userId,
    sender_email: info.email,
    source: 'mejl',
    gmail_message_id: info.messageId,
    file_name: info.fileName,
    file_path: path,
    file_size: info.size,
    mime_type: info.mimeType,
  }).select('id').single();

  if (error) {
    // Dubblett: någon hann före. Filen vi just laddade upp behövs inte.
    await supabase.storage.from(UNDERLAG_BUCKET).remove([path]);
    if (error.code === '23505') return { status: 'exists' };
    throw new Error(`Kunde inte spara ${info.fileName}: ${error.message}`);
  }

  // SIE-filer tolkas med kod direkt, så verifikationerna hamnar hos kunden.
  // Går det inte står felet på underlaget — filen är sparad oavsett.
  if (isSieFile(info.fileName)) {
    await importSieUnderlag(supabase, saved.id).catch((err) =>
      console.error(`[inmail/underlag] SIE-import av ${info.fileName}:`, err instanceof Error ? err.message : err));
  }

  return { status: 'saved' };
}

/**
 * Sparar bilagor som skickats med som base64 i själva mejlanropet. Används när
 * scriptet är en äldre version som inte laddar upp själv. Kastar aldrig — ett
 * misslyckat sparande här får inte stoppa resten av mejlflödet.
 */
export async function saveMailAttachments(params: {
  supabase: SupabaseClient;
  senderEmail: string;
  messageId: string;
  attachments: Array<{ base64?: string; mimeType?: string; name?: string }>;
}): Promise<number> {
  const { supabase, senderEmail, messageId } = params;
  const withData = params.attachments.filter((a) => a?.base64);
  if (!withData.length || !senderEmail?.includes('@')) return 0;

  let saved = 0;
  for (const [i, att] of withData.entries()) {
    const bytes = Buffer.from(att.base64!, 'base64');
    const info: MailFileInfo = {
      senderEmail,
      messageId,
      fileName: att.name?.trim() || `bilaga-${i + 1}`,
      size: bytes.length,
      mimeType: att.mimeType,
    };

    try {
      const prepared = await prepareMailUpload(supabase, info);
      if (prepared.status === 'exists') continue;

      const { error } = await supabase.storage
        .from(UNDERLAG_BUCKET)
        .upload(prepared.path, bytes, { contentType: normalize(info).mimeType, upsert: false });
      if (error) throw new Error(`Kunde inte ladda upp: ${error.message}`);

      const result = await confirmMailUpload(supabase, { ...info, path: prepared.path });
      if (result.status === 'saved') saved++;
    } catch (err) {
      console.error(`[inmail/underlag] ${info.fileName} från ${senderEmail}:`, err instanceof Error ? err.message : err);
    }
  }
  return saved;
}
