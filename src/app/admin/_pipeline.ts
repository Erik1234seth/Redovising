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
