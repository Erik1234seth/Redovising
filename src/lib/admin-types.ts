/**
 * Formen på det adminpanelen visar.
 *
 * Ligger utanför route-filen med flit: en `route.ts` i App Router får bara
 * exportera HTTP-metoder och ett par konfigurationsvärden, så delade typer
 * måste bo någon annanstans.
 */

export type EventType =
  | 'lead' | 'mejl' | 'sms_ut' | 'sms_in' | 'mote'
  | 'lank' | 'trad' | 'konto' | 'order' | 'fil' | 'optout';

export interface TimelineEvent {
  at: string;
  type: EventType;
  title: string;
  /** Brödtext — SMS-innehåll, mötesmeddelande, ämnesrad. */
  detail?: string;
  /** Kort etikett till höger, t.ex. leveransstatus. */
  meta?: string;
  /** Något gick fel och bör synas som rött. */
  bad?: boolean;
}

export interface Person {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  stage: number | null;
  /** Raden i contact_requests som steget skrivs till. Saknas den går steget inte att ändra. */
  contactId: string | null;
  isCustomer: boolean;
  optedOut: boolean;
  emailCount: number;
  smsCount: number;
  firstSeen: string;
  lastActivity: string;
}
