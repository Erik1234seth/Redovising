import type { NeManuellt } from '@/lib/ne/ne';
import type { SieIb } from '@/lib/sie/ingaende-balans';
import type { Deadlineperiod } from '@/lib/deadlines';
import type { Komplettering } from '@/lib/transaktioner/komplettera';
import type { Dublettkoll } from '@/lib/transaktioner/dublettkoll';
import type { Tillrackligt } from '@/lib/transaktioner/tillrackligt';
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

/** Hur ofta kunden redovisar moms (`profiles.moms_period`). "helår" betyder årsvis. */
export type MomsPeriod = 'månadsvis' | 'kvartalsvis' | 'helår' | 'ingen-moms';

/** Personens abonnemang (`subscriptions`), med priset som låstes när hen skrev upp sig. */
export interface Abonnemang {
  status: string;
  billingPeriod: 'monthly' | 'yearly';
  /** Kr exkl. moms per månad eller år. Null på rader från före prislåsningen. */
  prisKr: number | null;
  sedan: string;
}

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
  /** Momsperioden kunden valde i onboardingen. Finns bara när personen har konto. */
  momsPeriod: MomsPeriod | null;
  /** Året firman startade (`profiles.start_ar`). Med bokföringsmetoden flyttar det kunden till Kunder i inkorgen. */
  startAr: number | null;
  /** Företagskonto eller privatkonto. Null tills kunden eller vi valt. */
  betalsatt: Betalsatt | null;
  /** Säljer till företag i andra EU-länder och ska lämna periodisk sammanfattning. Sätts för hand. */
  periodiskSammanfattning: boolean;
  /** Första räkenskapsåret är förlängt, längre än tolv månader (`profiles.forlangt_rakenskapsar`). Sätts för hand. */
  forlangtRakenskapsar: boolean;
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

/**
 * Hur en punkt i bokslutschecklistan står.
 *
 * klart = finns, saknas = måste in innan bokslutet, kolla = något finns men
 * behöver ses över (eller vi vet inte om det behövs), ej = gäller inte kunden.
 */
export type BokslutStatus = 'klart' | 'saknas' | 'kolla' | 'ej';

export type BokslutPunktId =
  | 'orgnr' | 'momsnr' | 'verksamhet' | 'metod' | 'moms'
  | 'ne' | 'lager' | 'underlag';

/** Det som sparats för hand på en punkt (`profiles.bokslut_checklista`). */
export interface BokslutManuell {
  status: BokslutStatus | null;
  /** Underlaget som laddats upp på punkten, t.ex. förra årets NE-bilaga. */
  underlagId?: string | null;
  at: string;
}

/** Underlaget checklistan räknas fram ur. Uppgifterna som redan finns på Person står inte här. */
export interface BokslutData {
  orgNr: string | null;
  momsNr: string | null;
  /** true = första året, false = har deklarerat förut, null = inte besvarat. */
  forstaAret: boolean | null;
  startAr: number | null;
  inventarier: number;
  lagerposter: number;
  manuellt: Partial<Record<BokslutPunktId, BokslutManuell>>;
  /** Det som fyllts i för hand till NE-bilagan, per inkomstår ("2026"). */
  neUppgifter: Record<string, NeManuellt>;
  /** Ingående balanser ur kundens SIE-filer, per inkomstår ("2026"). */
  sieIb?: Record<string, SieIb>;
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
  /** Det som sorterades bort eller inte gick att tolka när filen lästes in. Tom när allt kom med. */
  varningar: string[];
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
  /** Sandlådans rad om vad den läste, när AI:n läst ut verifikationerna ur ett kalkylblad. */
  notering?: string | null;
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
  /** Det som sorterades bort eller inte gick att tolka när filen lästes in. Tom när allt kom med. */
  varningar: string[];
  /** Satt när filen är en SIE-fil som lagts in (eller försökts läggas in). */
  verifikationer: UnderlagImport | null;
  /** Satt när någon kört AI-avläsningen på filen. */
  transaktioner: UnderlagTransaktioner | null;
  /** Underlagskontrollen efter mejl: har underlaget allt vi behöver? Null = inte kontrollerad. */
  kontroll: { status: 'komplett' | 'saknar' | 'fel'; saknas: { rad: string; vad: string }[]; at: string } | null;
  /** underlag = ska bokföras, ovrigt = bra att ha men konteras inte, null = inte sorterad än. */
  sortering: 'underlag' | 'ovrigt' | null;
  /** Varför: "Skickad av oss", vad AI:n tyckte filen var, eller "Flyttad för hand". */
  sorteringOrsak: string | null;
}

/**
 * En transaktion som lästs ur ett underlag, innan den konterats.
 *
 * Steget före verifikationen: här står bara det som faktiskt stod på kvittot,
 * fakturan eller kontoutdraget.
 */
export interface AdminTransaktion {
  id: string;
  /** Underlagets id, eller bank:<konto> för rader som hämtats från banken. */
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
  /** Allt annat som stod om transaktionen på underlaget — kontext till konteringen. */
  detaljer: string;
  /** ai, manuell eller bank. */
  kalla: string;
  /** Bankrad: den transaktion ur underlagen som troligen är samma köp. */
  dublettAv: string | null;
  /** Bankrad: varför den troligen redan är bokförd, t.ex. en Zettle-utbetalning. */
  dublettOrsak: string | null;
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

/** Hur kunden betalar sina affärshändelser (`profiles.har_foretagskonto`). Avgör betalkontot i konteringen. */
export type Betalsatt = 'foretagskonto' | 'privatkonto' | 'bada';

/** En modells kontering av en transaktion (tabellen konteringar). */
export interface AdminKontering {
  modell: string;
  konto: string | null;
  kontonamn: string | null;
  momssats: number | null;
  motivering: string;
  /** Granskningens svar, när kontot fanns att pröva. */
  granskning: { stammer?: boolean; battre_konto?: string | null; granskning_kravs?: boolean; motivering?: string; forstaKonto?: string; svarade?: string } | null;
  flaggor: { typ: string; allvar: 'stopp' | 'granskning'; text: string }[];
  omdome: 'gron' | 'gul' | 'rod';
}

/** En transaktion i konteringsfliken: modellernas förslag och, när den bokförts, verifikationen. */
export interface AdminKonteringRad {
  id: string;
  datum: string;
  beskrivning: string;
  motpart: string;
  belopp: number;
  moms: number | null;
  valuta: string;
  riktning: 'in' | 'ut';
  kalla: string;
  fileName: string | null;
  /** Allt annat som stod om transaktionen på underlaget. */
  detaljer: string;
  /** Osäkerheter från avläsningen, svar från kunden och byråns ändringar och instruktioner. */
  anteckning: string;
  konteringar: AdminKontering[];
  verifikation: {
    id: string;
    signatur: string | null;
    rader: { konto: string; kontonamn: string | null; belopp: number }[];
  } | null;
}

/** En period på inlämningssidan: deadline, om den är inlämnad och vad som ser fel ut. */
export interface InlamningPeriod extends Deadlineperiod {
  /** Deadline har passerat utan att perioden markerats som inlämnad. */
  forsenad: boolean;
  /** Raden i `inlamningar`, när perioden markerats som inlämnad. */
  inlamning: { id: string; at: string; kvittensNamn: string | null } | null;
  /** Det som ser fel ut i bokföringen eller uppgifterna, i klartext. Visas rött. */
  flaggor: string[];
  antalVerifikationer?: number;
  antalTransaktioner?: number;
}

export interface InlamningKund {
  profileId: string;
  email: string | null;
  namn: string;
  foretag: string | null;
  momsPeriod: MomsPeriod | null;
  perioder: InlamningPeriod[];
}

/** En att göra-punkt på Ärenden-sidan (`arenden`). */
export interface Arende {
  id: string;
  titel: string;
  beskrivning: string | null;
  /** När det ska göras, YYYY-MM-DD. */
  datum: string | null;
  status: 'oppen' | 'klar';
  /** Mejl eller telefon — samma nyckel som `/admin/person/[key]`. */
  personKey: string | null;
  personNamn: string | null;
  /** Vem som skapade det: vi själva, mail-AI:n eller SMS-AI:n. */
  kalla: 'manuell' | 'mejl' | 'sms';
  skapad: string;
  klar: string | null;
  /** 'osaker' när AI:n tror att ärendet kan vara gjort men vill att någon bekräftar. */
  aiStatus?: 'osaker' | null;
  /** AI:ns senaste bedömning, t.ex. varför den stängde ärendet. */
  aiMotivering?: string | null;
  /** AI:n har skrivit ett mejlutkast för ärendet. */
  aiUtkast?: boolean;
}

/** Ett bokat möte (`meetings`), som det visas bland ärendena. */
export interface AdminMote {
  id: string;
  namn: string | null;
  email: string | null;
  telefon: string | null;
  datum: string;
  tid: string | null;
  meddelande: string | null;
}

/** Inkorgens tre flikar: leads, uppsignade som saknar startår eller bokföringsmetod, och klara kunder. */
export type InkorgKategori = 'lead' | 'saknar' | 'kund';

/** En rad i inkorgen — en person, med det senaste som hänt i mejl eller SMS. */
export interface InkorgKonversation {
  key: string;
  namn: string;
  email: string | null;
  phone: string | null;
  kategori: InkorgKategori;
  senaste: { kanal: 'mejl' | 'sms'; riktning: 'in' | 'out'; text: string; amne: string | null; at: string };
  /** Något har kommit in sedan konversationen senast öppnades. */
  olast: boolean;
  /** Utkast som väntar på att skickas, mejl och SMS. */
  utkast: number;
}

export interface InkorgMeddelande {
  id: string;
  kanal: 'mejl' | 'sms';
  riktning: 'in' | 'out';
  at: string;
  text: string;
  amne?: string | null;
  /** Gmail-id, för att kunna svara i rätt tråd. */
  gmailMessageId?: string;
  gmailThreadId?: string;
  /** Kundens adress i mejlet. Kan vara en kopplad adress, inte den på kontot. */
  adress?: string;
  bilagor?: string[];
  /** SMS-status för utgående: sent, failed … */
  status?: string | null;
  /** Ett fast utskick (välkomst-SMS, påminnelse, mejlnotis) — inget någon skrivit. */
  automatisk?: boolean;
}

/** En fil som bifogas ett mejl från inkorgen. Ligger i lagringen under mejlbilagor/. */
export interface MejlBilaga {
  path: string;
  namn: string;
}

export interface InkorgUtkast {
  id: string;
  kanal: 'mejl' | 'sms';
  text: string;
  /** Mejladress eller telefonnummer. */
  till: string;
  amne?: string | null;
  /** Mejlet utkastet svarar på. Saknas det blir det ett nytt mejl. */
  svarPa?: string | null;
  fel?: string | null;
  at: string;
}

export interface InkorgTrad {
  person: Person;
  kategori: InkorgKategori;
  meddelanden: InkorgMeddelande[];
  utkast: InkorgUtkast[];
  arenden: Arende[];
  /** Anteckningarna AI:n får med: de generella och de som gäller personen. */
  anteckningar: AiAnteckning[];
}

/** En anteckning till AI:ns prompt (`ai_anteckningar`). */
export interface AiAnteckning {
  id: string;
  text: string;
  omfang: 'kund' | 'generell';
  at: string;
}

/** En kund med underlag, i flödesschemats väljare. */
export interface FlodesKund {
  /** Nyckel till personvyn, e:<adress>. */
  key: string;
  namn: string;
  underlag: { id: string; fileName: string; at: string; source: string; sortering: 'underlag' | 'ovrigt' | null }[];
}

/** Allt som hänt med ett underlag, för att följa det genom flödesschemat. */
export interface FlodesUnderlag {
  id: string;
  fileName: string;
  /** app, mejl eller admin (uppladdat av oss). */
  source: string;
  at: string;
  personKey: string | null;
  sortering: 'underlag' | 'ovrigt' | null;
  sorteringOrsak: string | null;
  /** AI:ns definition (se `@/lib/underlag/definiera`). Null = inte definierat än. */
  definition: {
    kategori: 'transaktioner' | 'verifikationer' | 'ovrigt';
    dokumenttyp: string;
    beskrivning: string;
    ar: number | null;
    motivering: string;
    modell: string;
  } | null;
  definieradAt: string | null;
  definitionFel: string | null;
  kontroll: { status: 'komplett' | 'saknar' | 'fel'; saknas: { rad: string; vad: string }[]; at: string } | null;
  /** AI-avläsningen till transaktioner. */
  utlasning: { at: string; antal: number; fel: string | null } | null;
  /** Steget Komplettera med kundhistorik. */
  komplettering: { at: string; fel: string | null } | null;
  /** Steget Dublettcheck. */
  dublettkoll: { at: string; fel: string | null } | null;
  /** Steget Tillräckligt?. */
  tillrackligt: { at: string; fel: string | null } | null;
  /**
   * Steget Skriv mail: det senaste frågemejlet till kunden som underlagets
   * transaktioner kom med i (ett per kund och dygn). Null = inte frågat än.
   * `antal` är hur många av underlagets transaktioner mejlet frågar om.
   */
  mejl: { id: string; status: string; till: string; amne: string | null; text: string; at: string; skickat: string | null; antal: number } | null;
  /** SIE-filen inlagd som verifikationer. */
  sie: { at: string; antal: number; dubbletter: number; fel: string | null } | null;
  transaktioner: {
    id: string;
    datum: string | null;
    beskrivning: string;
    motpart: string;
    belopp: number;
    moms: number;
    valuta: string;
    riktning: 'in' | 'ut';
    vatNummer: string;
    anteckning: string;
    detaljer: string;
    /** Det AI:n plockat ut i fasta fält (se UPPGIFTSREGEL i `@/lib/transaktioner/normalisera`). */
    uppgifter: Record<string, unknown> | null;
    komplettering: Komplettering | null;
    dublettkoll: Dublettkoll | null;
    /** Satt när transaktionen är en dubblett och inte ska bokföras — av dublettkollen eller bankens koll. */
    dublettAv: string | null;
    tillrackligt: Tillrackligt | null;
    /** ingen = inte konterad, gron = båda modellerna gröna och överens, granska = allt annat. */
    kontering: 'ingen' | 'gron' | 'granska';
    bokford: boolean;
    /** Modellernas konteringar — förslagen när transaktionen ska granskas. */
    forslag: { modell: string; konto: string | null; kontonamn: string | null; momssats: number; omdome: string; motivering: string; granskning: AdminKontering['granskning']; flaggor: AdminKontering['flaggor']; /** Namnen på kundreglerna modellen valde. */ regler: string[] }[];
    /** Verifikationen transaktionen blev, med sina rader. */
    verifikation: { id: string; datum: string | null; signatur: string; rader: { konto: string; kontonamn: string | null; belopp: number }[] } | null;
  }[];
  /** Verifikationer som pekar på underlaget. */
  verifikationer: number;
  /** Byråns kontext och regler som gäller underlaget, skrivna på ett steg i schemat. */
  instruktioner: FlodesInstruktion[];
}

export interface FlodesInstruktion {
  id: string;
  typ: 'kontext' | 'regel';
  omfang: 'transaktion' | 'underlag' | 'kund' | 'alla';
  /** Steget den skrevs på: komplettera, dublett, tillrackligt, skriv-mejl eller konteras. */
  steg: string;
  transaktionId: string | null;
  namn: string | null;
  galler: string | null;
  text: string;
  at: string;
}

/** Något som gått fel, för översiktens varningar (/api/admin/varningar). */
export interface AdminVarning {
  id: string;
  allvar: 'fel' | 'varning';
  kategori: string;
  titel: string;
  detalj?: string;
  at: string;
  /** Vem det gäller: e-post eller profil-id, för länken till personkortet. */
  person?: string;
  personNamn?: string;
  /** Misslyckade utskick kan markeras som hanterade. */
  utskick?: { channel: 'mejl' | 'sms'; id: string };
}
