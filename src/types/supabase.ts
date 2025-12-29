export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  created_at: string;
  last_login: string | null;
  order_count: number;
}

export interface Order {
  id: string;
  user_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_company: string | null;
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
