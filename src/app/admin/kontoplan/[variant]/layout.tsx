'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

/**
 * Två kontoplaner med samma uppbyggnad: Löpande bokföring och Bokslut. De har
 * var sin länk i menyraden, och var sina flikar för konton, regler och historik.
 */
const NAMN: Record<string, string> = { lopande: 'Löpande bokföring', bokslut: 'Bokslut' };

export default function KontoplanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const variant = String(useParams().variant);
  if (!NAMN[variant]) return <p className="text-sm text-red-600">Okänd kontoplan.</p>;
  const bas = `/admin/kontoplan/${variant}`;
  const flikar = [
    { href: bas, label: 'Konton' },
    { href: `${bas}/regler`, label: 'Regler' },
    { href: `${bas}/historik`, label: 'Historik' },
  ];
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900">{NAMN[variant]}</h1>
      <p className="text-xs text-slate-500">
        {variant === 'lopande' ? 'Kontoplanen och reglerna som konteringen i Flöde använder.' : 'Kontoplanen och reglerna för bokslutet.'}
      </p>
      <div className="flex gap-1 border-b border-slate-200 mt-2 mb-4">
        {flikar.map((f) => (
          <Link key={f.href} href={f.href}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${pathname === f.href ? 'border-blue-600 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {f.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
