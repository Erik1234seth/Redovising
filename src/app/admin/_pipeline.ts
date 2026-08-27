import type { EventType } from '@/lib/admin-types';

/** Stegen en kund går igenom, i ordning. Speglar contact_requests.stage. */
export const STAGES = [
  { step: 1, label: 'Mail' },
  { step: 2, label: 'Bestämt möte' },
  { step: 3, label: 'Skickat in filer' },
  { step: 4, label: 'Skickat NE-bilaga' },
  { step: 5, label: 'Lämnat in NE-bilaga' },
] as const;

/** Hur varje händelsetyp visas i tidslinjen. */
export const EVENT_STYLE: Record<EventType, { label: string; dot: string }> = {
  lead: { label: 'Lead', dot: 'bg-gold-500' },
  mejl: { label: 'Mejl', dot: 'bg-blue-400' },
  sms_ut: { label: 'SMS ut', dot: 'bg-green-400' },
  sms_in: { label: 'SMS in', dot: 'bg-purple-400' },
  mote: { label: 'Möte', dot: 'bg-gold-400' },
  lank: { label: 'Länk', dot: 'bg-blue-300' },
  trad: { label: 'Mejltråd', dot: 'bg-blue-500' },
  konto: { label: 'Konto', dot: 'bg-green-500' },
  order: { label: 'Order', dot: 'bg-gold-600' },
  fil: { label: 'Fil', dot: 'bg-warm-400' },
  optout: { label: 'Avreg', dot: 'bg-red-400' },
};

export function shortDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export function fullDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

/** "3 min sedan", "2 tim sedan", "i går 11:36". Notiser läses i den takten. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'nyss';
  if (minutes < 60) return `${minutes} min sedan`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;

  const days = Math.round(hours / 24);
  if (days === 1) return `i går ${new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
  if (days < 7) return `${days} dagar sedan`;
  return fullDate(iso);
}

/** Twilio delar långa SMS i segment som debiteras var för sig. */
const GSM_SEGMENT = 160;
const UNICODE_SEGMENT = 70;

/**
 * Ungefär hur många SMS texten blir. Ett tecken utanför Latin-1 — en emoji, ett
 * tankstreck klistrat från Word — tvingar Twilio till UCS-2, och då ryms 70
 * tecken per segment istället för 160. Räknaren finns för att den skillnaden
 * ska synas innan man trycker skicka, inte på fakturan.
 */
export function segments(text: string): number {
  if (!text) return 0;
  const unicode = [...text].some((c) => (c.codePointAt(0) ?? 0) > 0xff);
  return Math.ceil(text.length / (unicode ? UNICODE_SEGMENT : GSM_SEGMENT));
}
