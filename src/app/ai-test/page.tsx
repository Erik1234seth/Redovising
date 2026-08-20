'use client';

import { useState } from 'react';
import UnderlagPanel from './UnderlagPanel';
import SiePanel from './SiePanel';
import { NAV_BG, ACCENT, CORAL } from './theme';

type Flik = 'underlag' | 'sie';

const FLIKAR: { id: Flik; namn: string; beskrivning: string }[] = [
  {
    id: 'underlag',
    namn: 'Underlag (AI)',
    beskrivning:
      'Ladda upp kvitton och fakturor. De tolkas först till transaktionsrader, sedan konterar du de rader du markerar. Inget sparas i databasen.',
  },
  {
    id: 'sie',
    namn: 'SIE4-fil',
    beskrivning:
      'Tolkar en SIE4-fil och listar varje verifikationsrad som en egen transaktion. Ingen AI inblandad — formatet läses rakt av.',
  },
];

export default function AiTestPage() {
  const [flik, setFlik] = useState<Flik>('underlag');
  const aktiv = FLIKAR.find((f) => f.id === flik)!;

  return (
    <div className="min-h-screen text-slate-100" style={{ background: NAV_BG }}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">AI-testmiljö</h1>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: `${CORAL}22`, color: CORAL }}
            >
              endast lokalt
            </span>
          </div>

          <nav className="mt-5 flex gap-1 border-b border-white/10">
            {FLIKAR.map((f) => (
              <button
                key={f.id}
                onClick={() => setFlik(f.id)}
                className="-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition"
                style={{
                  borderColor: flik === f.id ? ACCENT : 'transparent',
                  color: flik === f.id ? '#fff' : 'rgb(148 163 184)',
                }}
              >
                {f.namn}
              </button>
            ))}
          </nav>

          <p className="mt-4 text-sm text-slate-300">{aktiv.beskrivning}</p>
        </header>

        {/* Båda ligger kvar monterade så att uppladdningar och resultat
            överlever ett flikbyte. */}
        <div className={flik === 'underlag' ? '' : 'hidden'}>
          <UnderlagPanel />
        </div>
        <div className={flik === 'sie' ? '' : 'hidden'}>
          <SiePanel />
        </div>
      </div>
    </div>
  );
}
