import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON, formatAmount } from '../openai-client';

interface ReceiptAnalysis {
  vad: string;
  datum: string | null;
  belopp: number;
  moms: number;
  land: string;
  avsandare: string;
  betalningssatt: string | null;
}

const RECEIPT_SYSTEM_PROMPT = `Du är expert på svensk bokföring och kvittoanalys. Analysera kvittot/fakturan och returnera JSON med exakt dessa fält:
{
  "vad": "kort beskrivning av vad som köptes",
  "datum": "YYYY-MM-DD eller null",
  "belopp": number (totalt inkl moms),
  "moms": number (momsbelopp, 0 om ej synligt),
  "land": "Sverige" eller "EU" eller "Utanför EU",
  "avsandare": "namn på utfärdaren/leverantören",
  "betalningssatt": "Kontant" eller "Från företagskonto" eller "Från privatkonto" eller null
}`;

async function loadPdfjs(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs'); // eslint-disable-line @typescript-eslint/no-explicit-any
  const workerPath = require('path').resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  return pdfjsLib;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => (item as any).str ?? '').join(' ') + '\n'; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return text.trim();
}

async function pdfPageToBase64(buffer: Buffer): Promise<string> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d') as any, viewport }).promise; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (canvas.toBuffer('image/png') as Buffer).toString('base64');
}

async function analyzeReceipt(fileBase64: string, mimeType: string): Promise<ReceiptAnalysis> {
  const buffer = Buffer.from(fileBase64, 'base64');
  let userContent: unknown;

  if (mimeType === 'application/pdf') {
    const text = await extractPdfText(buffer);
    if (text.length > 50) {
      userContent = `Analysera detta kvitto/faktura.\n\nInnehåll från PDF:\n${text}`;
    } else {
      const imageBase64 = await pdfPageToBase64(buffer);
      userContent = [
        { type: 'text', text: 'Analysera detta kvitto/faktura.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ];
    }
  } else {
    userContent = [
      { type: 'text', text: 'Analysera detta kvitto/faktura.' },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
    ];
  }

  const raw = await callOpenAI({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: RECEIPT_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    responseFormat: { type: 'json_object' },
    maxTokens: 1000,
  });

  return parseJSON<ReceiptAnalysis>(raw);
}

export async function handleNewTransaction(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  gmailThreadId: string;
  messageId: string;
  attachments: Array<{ base64: string; mimeType: string; name: string }>;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, gmailThreadId, messageId, attachments } = params;

  if (!attachments.length) {
    return {
      action: 'no_attachment',
      replyBody: `Hej${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}!\n\nVi fick ditt mejl men kunde inte hitta något kvitto eller faktura bifogat.\n\nBifoga gärna kvittot som PDF, JPG eller PNG så bokför vi det direkt.\n\n// Enkla Bokslut`,
    };
  }

  const results: Array<{ analysis: ReceiptAnalysis; transactionId: string }> = [];

  for (const att of attachments) {
    let analysis: ReceiptAnalysis;
    try {
      analysis = await analyzeReceipt(att.base64, att.mimeType);
    } catch (err) {
      console.error('analyzeReceipt failed for', att.name, err);
      continue;
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: tx, error: txError } = await supabase
      .from('bokforing_transaktioner')
      .insert({
        user_id: profile.id,
        haendelse_typ: 'kopt-nagot',
        datum: analysis.datum ?? today,
        beskrivning: analysis.vad,
        belopp: Math.abs(analysis.belopp),
        moms: analysis.moms,
        kund_land: analysis.land,
        betalningssatt: analysis.betalningssatt ?? 'Från företagskonto',
        ovrigt: analysis.avsandare ? `Utfärdare: ${analysis.avsandare}` : null,
        ai_kategori: analysis.vad,
      })
      .select('id')
      .single();

    if (txError || !tx) continue;
    results.push({ analysis, transactionId: tx.id });
  }

  if (!results.length) {
    return {
      action: 'analysis_failed',
      replyBody: `Hej${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}!\n\nVi kunde tyvärr inte tolka ${attachments.length > 1 ? 'bilagorna' : 'bilagan'}. Kontrollera att filen är ett tydligt kvitto eller en faktura och skicka gärna igen.\n\n// Enkla Bokslut`,
    };
  }

  await supabase.from('email_threads').upsert({
    user_id: profile.id,
    gmail_thread_id: gmailThreadId,
    last_message_id: messageId,
    transaction_ids: results.map(r => r.transactionId),
    state: null,
  }, { onConflict: 'gmail_thread_id' });

  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';
  const lines = results.map((r, i) => {
    const a = r.analysis;
    return `${i + 1}. ${a.avsandare || 'Okänd'} — ${formatAmount(a.belopp)}\n   Vad: ${a.vad} · Datum: ${a.datum ?? 'okänt'} · Moms: ${formatAmount(a.moms)} · Betalat: ${a.betalningssatt ?? 'okänt'}`;
  });

  const replyBody = `Hej${firstName}!\n\nVi har bokfört ditt${results.length > 1 ? ` ${results.length} kvitton` : ' kvitto'}:\n\n${lines.join('\n\n')}\n\nStämmer det? Svara på det här mejlet om något behöver ändras.\n\n// Enkla Bokslut`;

  return { action: 'ok', replyBody };
}
