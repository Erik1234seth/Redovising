'use client';

import { useEffect, useRef, useState } from 'react';
import type { Innehall, Sprak } from './content';

/**
 * Menyn i toppen.
 *
 * Den ligger bara över heron och scrollar bort med den — ingen meny följer
 * med nedåt. Genomskinlig med vit text, så filmen får hela skärmen.
 *
 * Avsnittslänkarna ligger i en dropdown. Den stängs när man väljer ett
 * avsnitt, klickar utanför eller trycker Escape.
 *
 * Flaggorna byter språk på plats, utan att ladda om sidan: filmen spelar
 * vidare och figurer som redan animerats står kvar. Flaggorna är SVG och
 * inte emoji — Windows ritar inte flagg-emoji, där blir de bara "SE" och "GB".
 */
export default function Meny({
  meny,
  sprak,
  onByt,
}: {
  meny: Innehall['meny'];
  sprak: Sprak;
  onByt: (sprak: Sprak) => void;
}) {
  const [oppen, setOppen] = useState(false);
  const rot = useRef<HTMLDivElement>(null);
  const knapp = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!oppen) return;

    const klickUtanfor = (e: PointerEvent) => {
      if (!rot.current?.contains(e.target as Node)) setOppen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOppen(false);
      knapp.current?.focus();
    };

    document.addEventListener('pointerdown', klickUtanfor);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', klickUtanfor);
      document.removeEventListener('keydown', escape);
    };
  }, [oppen]);

  return (
    <nav className="eb-meny" aria-label={meny.etikett}>
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-6 px-6 lg:px-10">
        <a href="#top" className="eb-meny__varumarke">
          <span className="eb-meny__namn">{meny.varumarke}</span>
          <span className="eb-meny__del">{meny.del}</span>
        </a>

        <div className="flex items-center gap-7">
          <div ref={rot} className="eb-meny__dropdown">
            <button
              ref={knapp}
              type="button"
              className="eb-meny__oppna"
              aria-expanded={oppen}
              aria-controls="eb-meny-avsnitt"
              onClick={() => setOppen((o) => !o)}
            >
              {meny.etikett}
              <svg viewBox="0 0 10 6" aria-hidden="true" className="eb-meny__pil">
                <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>

            <ul id="eb-meny-avsnitt" className="eb-meny__panel" hidden={!oppen}>
              {meny.lankar.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setOppen(false)}>
                    {l.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <a href={meny.kontakt.href} className="eb-meny__kontakt">
            {meny.kontakt.text}
          </a>

          <div className="eb-meny__sprak">
            <button
              type="button"
              lang="sv"
              aria-label="Svenska"
              aria-pressed={sprak === 'sv'}
              className="eb-meny__flagga"
              onClick={() => onByt('sv')}
            >
              <FlaggaSverige />
            </button>
            <button
              type="button"
              lang="en"
              aria-label="English"
              aria-pressed={sprak === 'en'}
              className="eb-meny__flagga"
              onClick={() => onByt('en')}
            >
              <FlaggaStorbritannien />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function FlaggaSverige() {
  return (
    <svg viewBox="0 0 16 10" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="16" height="10" fill="#006AA7" />
      <rect x="5" width="2" height="10" fill="#FECC02" />
      <rect y="4" width="16" height="2" fill="#FECC02" />
    </svg>
  );
}

function FlaggaStorbritannien() {
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <clipPath id="eb-uk-kryss">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#eb-uk-kryss)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
