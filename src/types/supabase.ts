export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  org_nr: string | null;
  adress: string | null;
  postnummer: string | null;
  ort: string | null;
  momsnr: string | null;
  created_at: string;
  last_login: string | null;
  order_count: number;
  verksamhet: string | null;
  start_ar: number | null;
  /**
   * Om det är kundens första år att deklarera för sin enskilda firma. Frågas i
   * onboardingen; null på alla profiler som skapades innan frågan fanns.
   */
  forsta_deklarationsar: boolean | null;
  moms_period: 'månadsvis' | 'kvartalsvis' | 'helår' | 'ingen-moms' | null;
  saljer_till: 'privat' | 'foretag' | null;
  saljer_i: 'sverige' | 'eu' | 'utanfor-eu' | null;
  koper_i: 'sverige' | 'eu' | 'import' | null;
  /**
   * Vilket konto företagets utgifter betalas från. Frågan var tidigare ja/nej
   * ("har du företagskonto?"), så 'ja' och 'nej' ligger kvar på ett fåtal
   * profiler och läses fortfarande — nya svar skrivs alltid som kontotyp.
   */
  har_foretagskonto: 'foretagskonto' | 'privatkonto' | 'bada' | 'ja' | 'nej' | null;
  bokforing_metod: 'excel-kalkylark' | 'hemsidan' | 'maila-underlag' | null;
  /** Kontantmetoden eller faktureringsmetoden — inte samma sak som raden ovan. */
  redovisningsmetod: 'faktureringsmetoden' | 'kontantmetoden' | null;
  skicka_in_metod: 'maila-fil' | 'ladda-upp' | null;
  onboarding_done: boolean;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface Order {
  id: string;
  user_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_company: string | null;
  guest_org_nr: string | null;
  package_type: string;
  bank: string;
  status: string;
  created_at: string;
}

export interface ContactInfo {
  email: string;
  name: string;
  phone: string;
  company: string;
}
