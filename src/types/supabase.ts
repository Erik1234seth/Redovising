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
  moms_period: 'månadsvis' | 'kvartalsvis' | 'helår' | null;
  onboarding_done: boolean;
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
