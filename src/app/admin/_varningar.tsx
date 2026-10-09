'use client';

import { useState } from 'react';

/**
 * Det som sorterades bort eller inte gick att tolka, i gult under filen.
 * Varje filter i inläsningen räknar vad det tar bort — utan den här raden
 * skulle en tappad rad bara synas som ett belopp som inte stämmer senare.
 * En SIE-fil kan ge en varning per trasig rad, så listan fälls ihop.
 */

const SYNLIGA = 3;

export function Varningar({ varningar, className = '' }: { varningar: string[]; className?: string }) {
  const [alla, setAlla] = useState(false);
  if (varningar.length === 0) return null;
  const visade = alla ? varningar : varningar.slice(0, SYNLIGA);
  return (
    <span className={`block text-amber-300 text-[11px] leading-snug ${className}`}>
      {visade.map((v, i) => <span key={i} className="block">⚠ {v}</span>)}
      {varningar.length > SYNLIGA && (
        <button onClick={() => setAlla(!alla)} className="text-amber-400/80 hover:text-amber-300 underline">
          {alla ? 'Visa färre' : `+ ${varningar.length - SYNLIGA} till`}
        </button>
      )}
    </span>
  );
}
