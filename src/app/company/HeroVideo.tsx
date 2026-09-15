'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Heron s bakgrundsfilm.
 *
 * Alla klipp ligger som egna lager ovanpå varandra och bara ett är synligt åt
 * gången. När ett klipp tar slut startas nästa och opaciteten tonas över, så
 * skarven aldrig syns. Med ett enda klipp loopar det i stället — komponenten
 * gör alltså rätt sak oavsett hur många filer som finns i /public.
 *
 * Filmen tonas in vid sidladdning i stället för att slå på: det första som
 * händer på sidan ska inte vara ett hopp.
 */
export default function HeroVideo({
  klipp,
  poster,
  filter,
}: {
  klipp: string[];
  poster?: string;
  /** CSS-filter för klippet, t.ex. för att göra det svartvitt före tonen. */
  filter?: string;
}) {
  const [aktiv, setAktiv] = useState(0);
  const [redo, setRedo] = useState(false);
  const lager = useRef<(HTMLVideoElement | null)[]>([]);

  // Tonar in först efter montering, annars finns inget att animera från.
  useEffect(() => setRedo(true), []);

  useEffect(() => {
    if (klipp.length < 2) return;
    const el = lager.current[aktiv];
    if (!el) return;

    const vidare = () => {
      const nasta = (aktiv + 1) % klipp.length;
      const n = lager.current[nasta];
      if (n) {
        n.currentTime = 0;
        // Autoplay kan nekas i bakgrundsflikar. Det är inte ett fel värt
        // att bryta på — bilden står still tills fliken är i förgrunden.
        void n.play().catch(() => {});
      }
      setAktiv(nasta);
    };

    el.addEventListener('ended', vidare);
    return () => el.removeEventListener('ended', vidare);
  }, [aktiv, klipp.length]);

  return (
    <>
      {klipp.map((src, i) => (
        <video
          key={src}
          ref={(el) => {
            lager.current[i] = el;
          }}
          className={`eb-hero__video${redo && i === aktiv ? ' is-aktiv' : ''}`}
          src={src}
          autoPlay={i === 0}
          muted
          playsInline
          loop={klipp.length === 1}
          preload="auto"
          poster={poster || undefined}
          style={filter ? { filter } : undefined}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
