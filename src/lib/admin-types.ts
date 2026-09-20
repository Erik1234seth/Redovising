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
  /** Det råa felmeddelandet, för den som vill se exakt vad som hände. */
  technical?: string;
  /** Satt på misslyckade utskick, så att de går att markera som hanterade. */
  issue?: { channel: 'mejl' | 'sms'; id: string; dismissed: boolean };
}

/** Ett utskick som inte gick som det skulle, i klartext. */
export interface DeliveryIssue {
  /** Radens id i email_log respektive sms_messages. */
  id: string;
  at: string;
  channel: 'mejl' | 'sms';
  /** Vad som skickades, t.ex. ämnesraden eller "Välkomst-SMS". */
  what: string;
  /** Förklaringen på svenska. */
  reason: string;
}

/**
 * Hur kundens affärshändelser bokförs.
 *
 * Inte samma sak som `profiles.bokforing_metod`, som handlar om hur underlagen
 * kommer in till oss. De två går lätt att blanda ihop — därför det längre namnet.
 */
export type Redovisningsmetod = 'faktureringsmetoden' | 'kontantmetoden';

export interface Person {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** Kundens egen beskrivning av vad firman gör (`profiles.verksamhet`). */
  verksamhet: string | null;
  source: string | null;
  stage: number | null;
  /** Raden i contact_requests som steget skrivs till. Saknas den går steget inte att ändra. */
  contactId: string | null;
  /** Profilraden, när personen har ett konto. Metoden nedan skrivs helst hit. */
  profileId: string | null;
  /** Kontantmetoden eller faktureringsmetoden. Null tills någon valt. */
  redovisningsmetod: Redovisningsmetod | null;
  /**
   * Adresser som kopplats hit för hand, för att personen svarat från en annan
   * mejl än den vi kände till. Skiljda från de sammanslagna adresserna i
   * `other`: de här har någon valt, och går därför att ta bort igen.
   */
  manualEmails: { id: string; email: string }[];
  isCustomer: boolean;
  optedOut: boolean;
  emailCount: number;
  smsCount: number;
  /** Mejl och SMS som inte gick fram, nyast först. Tom när allt fungerat. */
  issues: DeliveryIssue[];
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
  /** app = uppladdat i appen, mejl = bilaga i ett inkommande mejl. */
  source: string;
  /** Vad en SIE-fil gav när den lades in hos kunden. */
  verifikationer: UnderlagImport | null;
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

/** Ett mejl i kundens mejlarkiv (mail_messages), synkat från Gmail. */
export interface AdminMailMessage {
  id: string;
  threadId: string;
  /** in = från kunden, out = från oss. */
  direction: 'in' | 'out';
  from: string | null;
  subject: string | null;
  /** Rensad från citat och signatur. Kan vara tom — då står allt i raw. */
  body: string;
  raw: string;
  attachments: string[];
  at: string;
}

/** Vad ett SIE-underlag gav när det lades in hos kunden. */
export interface UnderlagImport {
  at: string;
  inlagda: number;
  dubbletter: number;
  fel: string | null;
}

/** Vad AI-avläsningen av ett underlag gav. */
export interface UnderlagTransaktioner {
  at: string;
  antal: number;
  /** Vad koden läste — blad, kolumn och antal rader. Tom för bilder och PDF. */
  notering: string | null;
  fel: string | null;
}

/** Ett underlag i listan på personsidan. */
export interface PersonUnderlag {
  id: string;
  fileName: string;
  source: string;
  status: string;
  at: string;
  mimeType: string | null;
  /** Satt när filen är en SIE-fil som lagts in (eller försökts läggas in). */
  verifikationer: UnderlagImport | null;
  /** Satt när någon kört AI-avläsningen på filen. */
  transaktioner: UnderlagTransaktioner | null;
}

/**
 * En transaktion som lästs ur ett underlag, innan den konterats.
 *
 * Steget före verifikationen: här står bara det som faktiskt stod på kvittot,
 * fakturan eller kontoutdraget.
 */
export interface AdminTransaktion {
  id: string;
  underlagId: string;
  fileName: string | null;
  /** Ordningen i filen. */
  radnr: number;
  /** Tom när datumet inte framgick av underlaget. */
  datum: string;
  beskrivning: string;
  motpart: string;
  belopp: number;
  moms: number | null;
  valuta: string;
  /** in = pengar in till företaget, ut = pengar ut. */
  riktning: 'in' | 'ut';
  /** AI:ns notering när något var oläsligt eller osäkert. */
  anteckning: string;
  /** ai eller manuell. */
  kalla: string;
  at: string;
}

/** En verifikation hos kunden (tabellen verifikationer). */
export interface AdminVerifikation {
  id: string;
  /** sie, ai eller manuell. */
  kalla: string;
  underlagId: string | null;
  fileName: string | null;
  serie: string;
  nummer: string;
  datum: string;
  text: string;
  registrerad: string;
  signatur: string;
  summa: number;
  balanserad: boolean;
  transaktioner: {
    konto: string;
    kontonamn: string;
    belopp: number;
    text: string;
    objekt: { dimension: string; objekt: string }[];
    borttagen: boolean;
    tillagd: boolean;
  }[];
}
