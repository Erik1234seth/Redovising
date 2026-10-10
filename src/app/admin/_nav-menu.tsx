'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Huvudsidorna, som vanliga länkar i menyraden — ingen dropdown.
 *
 * SMS-utkast, Underlag, Möten och Systemstatus togs bort härifrån 2026-10-10.
 * Sidorna finns kvar på sina adresser tills Inkorgen, Ärenden och Översikten
 * tar över det de gör.
 */

const ITEMS: { href: string; label: string }[] = [
  { href: '/admin/inkorg', label: 'Inkorg' },
  { href: '/admin/arenden', label: 'Ärenden' },
  { href: '/admin/kalender', label: 'Kalender' },
  { href: '/admin/inlamning', label: 'Inlämning' },
];

export default function NavMenu() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-4">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`text-sm transition hover:text-blue-700 ${
            pathname?.startsWith(item.href) ? 'text-slate-900 font-medium' : 'text-slate-600'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
