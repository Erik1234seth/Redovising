'use client';

import { useEffect, useRef, useState } from 'react';

const RUTOR = 100;
const LANGD_MS = 1800;

/**
 * Kundräknaren under "Proven demand".
 *
 * Siffran och rutorna drivs av samma värde, så en ruta fylls i exakt när
 * siffran passerar den — de kan inte glida isär. Uppräkningen bromsar in mot
 * slutet, och tillägget ("+") kommer först när siffran har landat.
 *
 * Startar på samma villkor som de andra figurerna: när överkanten scrollats
 * förbi den nedre tredjedelen av fönstret. Har besökaren bett om mindre
 * rörelse visas slutläget direkt.
 */
export default function Kundantal({
  antal,
  tillagg,
  etikett,
}: {
  antal: number;
  tillagg: string;
  etikett: string;
}) {
  const [varde, setVarde] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVarde(antal);
      return;
    }

    let bildruta = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const steg = (nu: number) => {
          const t = Math.min(1, (nu - start) / LANGD_MS);
          const utbromsad = 1 - Math.pow(1 - t, 3);
          setVarde(Math.round(utbromsad * antal));
          if (t < 1) bildruta = requestAnimationFrame(steg);
        };
        bildruta = requestAnimationFrame(steg);
      },
      { threshold: 0, rootMargin: '0px 0px -30% 0px' },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(bildruta);
    };
  }, [antal]);

  const klar = varde >= antal;
  const fyllda = Math.min(RUTOR, Math.round((varde / Math.max(antal, 1)) * Math.min(antal, RUTOR)));

  return (
    <div ref={ref} className="eb-kunder">
      <div className="eb-kunder__tal">
        {/* Skärmläsare får slutvärdet direkt, inte varje steg på vägen. */}
        <span className="sr-only">
          {antal}
          {tillagg} {etikett}
        </span>
        <div aria-hidden="true" className="eb-kunder__siffra eb-fig">
          {varde}
          <span className={`eb-kunder__tillagg${klar ? ' is-klar' : ''}`}>{tillagg}</span>
        </div>
        <div aria-hidden="true" className="mt-2 text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
          {etikett}
        </div>
      </div>

      <div className="eb-kunder__rutnat" aria-hidden="true">
        {Array.from({ length: RUTOR }, (_, i) => (
          <div key={i} className={`eb-kunder__ruta${i < fyllda ? ' is-fylld' : ''}`} />
        ))}
      </div>
    </div>
  );
}
