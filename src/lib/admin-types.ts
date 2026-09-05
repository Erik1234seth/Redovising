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

/** Hur en enskild kontroll gick i systemstatusen. */
export type StatusLevel = 'ok' | 'fail' | 'unknown';

export interface StatusCheck {
  id: string;
  label: string;
  level: StatusLevel;
  /** Vad kontrollen faktiskt såg. Visas under etiketten. */
  detail: string;
  /** Vad man gör åt det. Visas bara när nivån inte är ok. */
  hint?: string;
  /** Tidpunkten kontrollen bygger på, när det finns en. */
  at?: string | null;
}

export interface StatusGroup {
  title: string;
  /** Kort förklaring av vad gruppen bevisar. */
  note: string;
  checks: StatusCheck[];
}

export interface StatusReport {
  groups: StatusGroup[];
  checkedAt: string;
}

/**
 * Ett AI-svar som väntar på att godkännas på /admin/sms.
 *
 * Är en rad i `sms_messages` med `status: 'draft'` — ingen egen tabell. `body`
 * är AI:ns förslag, eller den senast sparade ändringen av det.
 */
export interface SmsDraft {
  id: string;
  phone: string;
  body: string;
  /** När utkastet skrevs. Ålder är det som avgör hur bråttom det är. */
  at: string;
  /** SMS:et personen skickade, som utkastet svarar på. */
  question: string | null;
  questionAt: string | null;
  /** Numret har skrivit STOPP medan utkastet låg. Då går det inte att skicka. */
  optedOut: boolean;
}

/**
 * Ett underlag kunden laddat upp i bokföringsfliken.
 *
 * Filen sparas rå vid uppladdningen — den tolkas först när Erik går igenom den,
 * så raden säger bara vad som kommit in och hur långt genomgången nått.
 */
export interface AdminUnderlag {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  /** inkommet | granskas | bokfort */
  status: string;
  at: string;
  /** Signerad nedladdningslänk. Bucketen är privat och länken lever en timme. */
  url: string | null;
  /** Nyckel till personvyn, när filen går att knyta till en profil. */
  personKey: string | null;
  personName: string | null;
  personEmail: string | null;
  company: string | null;
}

/** En bokad tid, som den visas i mötesvyn. */
export interface AdminMeeting {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** "YYYY-MM-DD" och "HH:MM", svensk tid. Lagras som text, inte tidsstämpel. */
  date: string;
  time: string;
  message: string | null;
  bookedAt: string;
  /** Var bokningen gjordes. */
  source: 'boka-mote' | 'popup' | 'flodet' | 'facebook' | 'okand';
  /** Nyckel till personvyn, när mötet går att knyta till en adress. */
  personKey: string | null;
  /** Påminnelse-SMS:ets status samma dag: 'sent', 'failed' eller null. */
  reminder: string | null;
  /** Tiden har passerat. Räknat i svensk tid på servern. */
  past: boolean;
}

/** En rad i notisklockan. */
export interface AdminNotice {
  id: string;
  at: string;
  /** ok = gick fram, fail = misslyckades, info = hände bara. */
  level: 'ok' | 'fail' | 'info';
  title: string;
  detail?: string;
  /** Nyckel till personvyn, när notisen går att knyta till någon. */
  personKey?: string | null;
}
