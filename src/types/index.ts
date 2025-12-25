export type Bank = 'swedbank' | 'seb' | 'nordea' | 'handelsbanken';

export type Package = 'ne-bilaga' | 'komplett';

export interface BankInfo {
  id: Bank;
  name: string;
  logo?: string;
  downloadVideoUrl?: string;
  accessDelegationVideoUrl?: string;
}

export interface PackageInfo {
  id: Package;
  name: string;
  price: number;
  description: string;
  features: string[];
}

export interface FlowStep {
  id: string;
  title: string;
  description: string;
  component?: string;
}
