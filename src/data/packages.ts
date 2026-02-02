import { PackageInfo } from "@/types";

export const packages: PackageInfo[] = [
  {
    id: 'ne-bilaga',
    name: 'NE-Bilaga',
    price: 1999,
    description: 'Perfekt för dig som vill sköta inlämningen själv',
    features: [
      'Du lämnar in själv till Skatteverket',
      'Bokföring baserat på dina kontoutdrag',
      'Förenklat årsbokslut',
      'Vi upprättar din NE-bilaga',
      'Snabb leverans',
      'Support vid frågor'
    ]
  },
  {
    id: 'komplett',
    name: 'Komplett Tjänst',
    price: 3499,
    description: 'Vi sköter allt åt dig från början till slut',
    features: [
      'Vi sköter inlämningen till Skatteverket',
      'Bokföring baserat på dina kontoutdrag',
      'Förenklat årsbokslut',
      'Vi upprättar din NE-bilaga',
      'Komplett hantering',
      'Full support'
    ]
  }
];
