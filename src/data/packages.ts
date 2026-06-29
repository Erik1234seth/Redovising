import { PackageInfo } from "@/types";

export const packages: PackageInfo[] = [
  {
    id: 'komplett',
    name: 'Komplett Tjänst',
    price: 299,
    yearlyPrice: 3499,
    period: '/mån',
    description: 'Allt inkluderat. Löpande abonnemang utan bindningstid.',
    features: [
      'Mejla bara in dina underlag',
      'Löpande bokföring',
      'Årsbokslut, moms och deklaration',
      'Vi lämnar in till Skatteverket',
      'Inget bokföringsprogram behövs',
      'Ingen bindningstid',
    ]
  }
];
