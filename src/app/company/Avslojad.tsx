'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Sätter klassen is-inne på sitt element första gången det scrollas in i bild,
 * och bara då. All faktisk rörelse ligger i CSS:en — den här komponenten
 * bestämmer bara när den får börja.
 *
 * Har besökaren bett om mindre rörelse sätts klassen direkt vid montering, så
 * figurerna visas i sitt slutläge utan att någonting animeras.
 */
export default function Avslojad({
  children,
  klass = '',
  nedreMarginal = 30,
  som: Som = 'div',
}: {
  children: React.ReactNode;
  klass?: string;
  /** Hur många procent av fönstrets nederkant som inte räknas som synlig. */
  nedreMarginal?: number;
  som?: 'div' | 'figure';
}) {
  const [inne, setInne] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInne(true);
      return;
    }

    // Den nedre delen av fönstret räknas inte som synlig. Figuren startar
    // alltså först när dess överkant har scrollats upp förbi den linjen och
    // läsaren faktiskt tittar på den — inte i samma ögonblick som kanten
    // nuddar skärmen, och inte vid sidladdning bara för att den råkar ligga
    // strax under heron på en hög skärm.
    //
    // Tröskeln mäts mot överkanten och inte mot hur stor andel av figuren som
    // syns: en hög figur på en låg skärm når aldrig 40 %, och då skulle den
    // aldrig starta.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setInne(true);
      },
      { threshold: 0, rootMargin: `0px 0px -${nedreMarginal}% 0px` },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [nedreMarginal]);

  return (
    <Som
      ref={ref as React.Ref<HTMLDivElement & HTMLElement>}
      className={`${klass}${inne ? ' is-inne' : ''}`}
    >
      {children}
    </Som>
  );
}
