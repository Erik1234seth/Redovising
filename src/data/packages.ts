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
      'Löpande bokföring',
      'Förenklat årsbokslut',
      'Vi upprättar din NE-bilaga',
      'Momsredovisning',
      'Överföring till momsdeklaration',
      'Vi sköter inlämningen till Skatteverket',
      'Avsluta när du vill – ingen bindningstid',
    ]
  }
];
