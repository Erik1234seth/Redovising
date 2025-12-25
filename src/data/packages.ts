import { PackageInfo } from "@/types";

export const packages: PackageInfo[] = [
  {
    id: 'ne-bilaga',
    name: 'NE-Bilaga',
    price: 1499,
    description: 'Perfekt för dig som vill sköta inlämningen själv',
    features: [
      'Vi upprättar din NE-bilaga',
      'Baserat på dina kontoutdrag',
      'Färdigt inom 24 timmar',
      'Du lämnar in själv till Skatteverket',
      'Support vid frågor'
    ]
  },
  {
    id: 'komplett',
    name: 'Komplett Tjänst',
    price: 3499,
    description: 'Vi sköter allt åt dig från början till slut',
    features: [
      'Vi upprättar din NE-bilaga',
      'Vi lämnar in till Skatteverket åt dig',
      'Baserat på dina kontoutdrag',
      'Komplett hantering',
      'Färdigt inom 24 timmar',
      'Full support'
    ]
  }
];
