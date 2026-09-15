'use client';

import { Fragment, useEffect, useState } from 'react';
import HeroVideo from './HeroVideo';
import HeroRutnat from './HeroRutnat';
import Avslojad from './Avslojad';
import Meny from './Meny';
import Kundantal from './Kundantal';
import { heroVideo, en, type Sprak } from './content';
import { sv } from './content.sv';

/**
 * Sethapps bolagssida på company.enklabokslut.se.
 *
 * Den här filen är bara layout — all text ligger i content.ts och
 * content.sv.ts. Den är en klientkomponent för att språkbytet ska ske på
 * plats: byts språket via en omladdning startar filmen om och alla figurer
 * animeras en gång till. Nu byts bara texten.
 *
 * Språket speglas i adressen (?lang=sv) så att en delad länk öppnas på rätt
 * språk, men med replaceState — inget nytt steg i historiken, ingen navigering.
 *
 * Formen är lånad från kontoutdraget: hela sidan hänger på en enda vänsterkant
 * och avsnittsnamnet ligger i marginalen som en ledtext. Tonen växlar vitt och
 * pappersgrått hela vägen ner, och mörkblått får ta över exakt en gång — den
 * försvarbara modellen, sidans tes. Sidfoten är mörk för att stänga.
 *
 * Varje avsnitt bär en figur som animeras en gång när den scrollas in.
 * Rörelsen finns i company.css; Avslojad bestämmer bara när den får börja.
 */

type Ton = 'vit' | 'papper' | 'navy';

const bakgrund: Record<Ton, string | undefined> = {
  vit: undefined,
  papper: 'var(--paper)',
  navy: 'var(--navy)',
};

/** Sidans genomgående spalt: ledtext i marginalen, innehåll i kolumnen. */
function Spalt({
  spine,
  children,
  mork = false,
}: {
  spine: string;
  children: React.ReactNode;
  mork?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-[9rem_1fr] lg:gap-x-16">
      <div className={`pt-2 text-sm font-medium ${mork ? 'text-white/40' : 'eb-spine'}`}>
        {spine}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Avsnitt({
  id,
  spine,
  rubrik,
  stycken,
  children,
  ton = 'vit',
}: {
  id?: string;
  spine: string;
  rubrik: string;
  stycken: string[];
  /** Avsnittets figur. */
  children?: React.ReactNode;
  ton?: Ton;
}) {
  const mork = ton === 'navy';
  return (
    <section id={id} style={{ background: bakgrund[ton] }} className={mork ? 'text-white' : undefined}>
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32 lg:px-10">
        <Spalt spine={spine} mork={mork}>
          <h2 className="max-w-[20ch] text-[2rem] sm:text-[2.6rem]">{rubrik}</h2>
          <div className="mt-8 max-w-[68ch] space-y-6">
            {stycken.map((p, i) => (
              <p
                key={i}
                className="text-[1.0625rem] leading-[1.7]"
                style={{ color: mork ? undefined : '#31465a' }}
              >
                <span className={mork ? 'text-white/70' : undefined}>{p}</span>
              </p>
            ))}
          </div>
          {children}
        </Spalt>
      </div>
    </section>
  );
}

function Bildtext({ children, mork = false }: { children: React.ReactNode; mork?: boolean }) {
  return (
    <p
      className={`mt-7 max-w-[64ch] text-sm leading-relaxed ${mork ? 'text-white/45' : ''}`}
      style={mork ? undefined : { color: 'var(--muted)' }}
    >
      {children}
    </p>
  );
}

export default function Sida({
  startSprak,
  video,
}: {
  startSprak: Sprak;
  /** null betyder det animerade rutnätet i stället för film. */
  video: { src: string; filter: string } | null;
}) {
  const [sprak, setSprak] = useState<Sprak>(startSprak);

  useEffect(() => {
    document.documentElement.lang = sprak;
  }, [sprak]);

  const byt = (nytt: Sprak) => {
    setSprak(nytt);
    const url = new URL(window.location.href);
    if (nytt === 'sv') url.searchParams.set('lang', 'sv');
    else url.searchParams.delete('lang');
    window.history.replaceState(window.history.state, '', url);
  };

  const {
    meny,
    hero,
    fokus,
    efterfragan,
    lonsamhet,
    standard,
    skalbarhet,
    plattform,
    forsvar,
    vagen,
    grundare,
    kontakt,
  } = sprak === 'sv' ? sv : en;
  const { kolumner, rader, segmentKolumner, segmentRader } = fokus.figur;

  return (
    <div className="eb min-h-screen" lang={sprak}>
      <Meny meny={meny} sprak={sprak} onByt={byt} />

      {/* ---------- Hero: filmen bakom, scrimmen bara bakom texten ---------- */}
      <header id="top" className="eb-hero">
        <div className="eb-hero__bg">
          <div className="eb-hero__fallback" />
          {video ? (
            <>
              <HeroVideo klipp={[video.src]} poster={heroVideo.poster} filter={video.filter} />
              <div className="eb-hero__ton" />
            </>
          ) : (
            <HeroRutnat />
          )}
          <div className="eb-hero__rules" />
        </div>

        <div className="eb-hero__scrimwrap" aria-hidden="true">
          <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
            <div className="eb-hero__scrim" />
          </div>
        </div>

        <div className="eb-hero__inner mx-auto w-full max-w-6xl px-6 lg:px-10">
          <div className="w-full">
            <Spalt spine={hero.spine} mork>
              <h1 className="eb-rise max-w-[17ch] text-[2.75rem] text-white sm:text-[4rem] lg:text-[4.75rem]">
                {hero.rubrik}
              </h1>

              <div className="eb-rise eb-rise-2 mt-10 max-w-[52ch] space-y-5">
                {hero.stycken.map((p, i) => (
                  <p key={i} className="text-[1.0625rem] leading-[1.75] text-white/75">
                    {p}
                  </p>
                ))}
              </div>

              <div className="eb-rise eb-rise-3 mt-11">
                <a
                  href={hero.cta.href}
                  className="inline-block pb-1.5 text-[0.9375rem] font-medium text-white"
                  style={{ borderBottom: '1px solid var(--coral)' }}
                >
                  {hero.cta.text}
                </a>
              </div>
            </Spalt>
          </div>
        </div>
      </header>

      {/* ---------- Fokuserad marknad ---------- */}
      <Avsnitt id="market" spine={fokus.spine} rubrik={fokus.rubrik} stycken={fokus.stycken}>
        <Avslojad som="figure" klass="mt-16">
          <div
            className="eb-falt"
            style={{ gridTemplateColumns: `repeat(${kolumner}, 1fr)` }}
            aria-hidden="true"
          >
            {Array.from({ length: kolumner * rader }, (_, i) => {
              const kolumn = i % kolumner;
              const rad = Math.floor(i / kolumner);
              const iSegment = kolumn < segmentKolumner && rad < segmentRader;
              return (
                <div
                  key={i}
                  className={`eb-falt__ruta${iSegment ? ' eb-falt__ruta--segment' : ''}`}
                  style={{ '--drojsmal': `${(kolumn + rad) * 14}ms` } as React.CSSProperties}
                />
              );
            })}

            {/* Ramen räknas ut från rutnätets egna mått, så den sitter exakt. */}
            <div
              className="eb-falt__ram"
              style={{
                width: `calc((100% - ${(kolumner - 1) * 3}px) / ${kolumner} * ${segmentKolumner} + ${
                  (segmentKolumner - 1) * 3 + 12
                }px)`,
                height: `calc((100% - ${(rader - 1) * 3}px) / ${rader} * ${segmentRader} + ${
                  (segmentRader - 1) * 3 + 12
                }px)`,
              }}
            />
          </div>

          <figcaption className="mt-8 flex items-center gap-2.5 text-sm font-medium">
            <span className="h-3 w-3 flex-none" style={{ background: 'var(--navy)' }} />
            {fokus.figur.etikett}
          </figcaption>

          <Bildtext>{fokus.figur.bildtext}</Bildtext>
        </Avslojad>
      </Avsnitt>

      {/* ---------- Bevisad efterfrågan ---------- */}
      <Avsnitt
        spine={efterfragan.spine}
        rubrik={efterfragan.rubrik}
        stycken={efterfragan.stycken}
        ton="papper"
      >
        <figure className="mt-16 max-w-4xl">
          <Kundantal
            antal={efterfragan.figur.antal}
            tillagg={efterfragan.figur.tillagg}
            etikett={efterfragan.figur.etikett}
          />
          <Bildtext>{efterfragan.figur.bildtext}</Bildtext>
        </figure>
      </Avsnitt>

      {/* ---------- Bevisad lönsamhet ---------- */}
      <Avsnitt id="economics" spine={lonsamhet.spine} rubrik={lonsamhet.rubrik} stycken={lonsamhet.stycken}>
        <Avslojad som="figure" klass="mt-20 max-w-3xl">
          <div className="pb-16 pt-10">
            <div className="eb-skala" style={{ '--till': `${lonsamhet.figur.nulage.position}%` } as React.CSSProperties}>
              <div className="eb-skala__passerat" />

              {[lonsamhet.figur.brytpunkt, lonsamhet.figur.nulage].map((p, i) => (
                <div
                  key={p.etikett}
                  className="eb-skala__punkt"
                  style={
                    {
                      '--vid': `${p.position}%`,
                      '--drojsmal': `${700 + i * 220}ms`,
                    } as React.CSSProperties
                  }
                >
                  <div className={`eb-skala__markor${i === 1 ? ' eb-skala__markor--nu' : ''}`} />
                  <div
                    className={`eb-skala__text ${i === 0 ? 'top-5' : '-top-8'}`}
                    style={{ color: i === 1 ? 'var(--coral)' : 'var(--muted)' }}
                  >
                    {p.etikett}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between text-sm" style={{ color: 'var(--muted)' }}>
              <span>{lonsamhet.figur.axel}</span>
              <span>{lonsamhet.figur.kvar}</span>
            </div>
          </div>

          <Bildtext>{lonsamhet.figur.bildtext}</Bildtext>
        </Avslojad>
      </Avsnitt>

      {/* ---------- Standardiserad leverans ---------- */}
      <Avsnitt
        spine={standard.spine}
        rubrik={standard.rubrik}
        stycken={standard.stycken}
        ton="papper"
      >
        <Avslojad som="figure" klass="mt-16 max-w-3xl">
          <div className="eb-staplar" aria-hidden="true">
            {standard.figur.fran.map((h, i) => (
              <div
                key={i}
                className="eb-staplar__stapel"
                style={
                  {
                    '--fran': `${h}%`,
                    '--till': `${standard.figur.till}%`,
                    '--drojsmal': `${i * 55}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          <figcaption
            className="eb-hair mt-4 flex justify-between pt-3 text-sm"
            style={{ borderColor: '#c6d4df', color: 'var(--muted)' }}
          >
            <span>{standard.figur.fore}</span>
            <span style={{ color: 'var(--navy)' }}>{standard.figur.efter}</span>
          </figcaption>

          <Bildtext>{standard.figur.bildtext}</Bildtext>
        </Avslojad>
      </Avsnitt>

      {/* ---------- Skalbarhet ---------- */}
      <Avsnitt spine={skalbarhet.spine} rubrik={skalbarhet.rubrik} stycken={skalbarhet.stycken}>
        <Avslojad som="figure" klass="mt-16 max-w-3xl">
          <svg className="eb-kurvor" viewBox="0 0 620 210" role="img" aria-label={skalbarhet.figur.bildtext}>
            <line x1="0" y1="200" x2="620" y2="200" stroke="var(--paper-edge)" strokeWidth="1" />

            <path
              className="eb-kurvor__linje eb-kurvor__linje--kunder"
              pathLength={1}
              d="M4 190 C 150 178, 270 140, 380 96 S 500 34, 560 18"
              style={{ '--drojsmal': '120ms' } as React.CSSProperties}
            />
            <path
              className="eb-kurvor__linje eb-kurvor__linje--arbete"
              pathLength={1}
              d="M4 190 C 160 187, 320 180, 430 172 S 520 164, 560 160"
              style={{ '--drojsmal': '320ms' } as React.CSSProperties}
            />

            <text
              className="eb-kurvor__etikett"
              x="570"
              y="22"
              fill="var(--coral)"
              fontSize="14"
              fontWeight="600"
            >
              {skalbarhet.figur.kunder}
            </text>
            <text
              className="eb-kurvor__etikett"
              x="570"
              y="164"
              fill="var(--navy)"
              fontSize="14"
              fontWeight="600"
            >
              {skalbarhet.figur.arbete}
            </text>
          </svg>

          <figcaption className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
            {skalbarhet.figur.axel}
          </figcaption>

          <Bildtext>{skalbarhet.figur.bildtext}</Bildtext>
        </Avslojad>
      </Avsnitt>

      {/* ---------- Egen teknikplattform ---------- */}
      <Avsnitt
        id="platform"
        spine={plattform.spine}
        rubrik={plattform.rubrik}
        stycken={plattform.stycken}
        ton="papper"
      >
        <Avslojad som="figure" klass="mt-16 max-w-4xl">
          <div className="eb-lager">
            {plattform.lager.map((l, i) => (
              <div
                key={l.titel}
                className="eb-lager__rad"
                style={{ '--drojsmal': `${i * 110}ms` } as React.CSSProperties}
              >
                <div className="font-semibold tracking-tight">{l.titel}</div>
                <div className="text-[0.9375rem] leading-relaxed" style={{ color: '#4a6072' }}>
                  {l.text}
                </div>
              </div>
            ))}
          </div>

          <Bildtext>{plattform.bildtext}</Bildtext>
        </Avslojad>
      </Avsnitt>

      {/* ---------- Försvarbar modell: sidans enda mörkblå avsnitt ---------- */}
      <Avsnitt spine={forsvar.spine} rubrik={forsvar.rubrik} stycken={forsvar.stycken} ton="navy">
        <Avslojad klass="mt-16 max-w-3xl">
          <div className="eb-samman">
            <div className="eb-samman__delar">
              {forsvar.delar.map((d, i) => (
                <div
                  key={d}
                  className="eb-samman__del text-[1.0625rem] text-white/80"
                  style={{ '--drojsmal': `${i * 130}ms` } as React.CSSProperties}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="eb-samman__skena">
              <div className="eb-samman__nod" />
            </div>
          </div>

          <p className="mt-10 max-w-[40ch] pl-7 text-[1.5rem] font-semibold leading-snug tracking-tight">
            <span style={{ borderLeft: '2px solid var(--coral)' }} className="-ml-7 pl-7">
              {forsvar.nav}
            </span>
          </p>
        </Avslojad>
      </Avsnitt>

      {/* ---------- Vägen framåt ---------- */}
      <Avsnitt id="path" spine={vagen.spine} rubrik={vagen.rubrik} stycken={vagen.stycken}>
        <Avslojad klass="mt-20 max-w-4xl">
          <div className="eb-etapper">
            {vagen.etapper.map((e, i) => (
              <Fragment key={e.titel}>
                {i > 0 && (
                  <div
                    className="eb-etapper__ral"
                    style={{ '--drojsmal': `${i * 240}ms` } as React.CSSProperties}
                  />
                )}
                <div
                  className="eb-etapp"
                  style={{ '--drojsmal': `${i * 240 + 120}ms` } as React.CSSProperties}
                >
                  <div className={`eb-etapp__markor${e.klar ? ' eb-etapp__markor--klar' : ''}`} />
                  <h3 className="mt-5 max-w-[20ch] text-[1.0625rem]">{e.titel}</h3>
                  <p
                    className="mt-2 max-w-[26ch] text-sm leading-relaxed"
                    style={{ color: 'var(--muted)' }}
                  >
                    {e.text}
                  </p>
                </div>
              </Fragment>
            ))}
          </div>
        </Avslojad>
      </Avsnitt>

      {/* ---------- Grundaren ---------- */}
      <section id="founder" style={{ background: 'var(--paper)' }}>
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28 lg:px-10">
          <Spalt spine={grundare.spine}>
            <Avslojad klass="eb-grundare">
              <div className="eb-grundare__portratt">
                {grundare.bild ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={grundare.bild} alt={grundare.namn} />
                ) : (
                  <span aria-hidden="true">
                    {grundare.namn
                      .split(' ')
                      .map((d) => d[0])
                      .join('')}
                  </span>
                )}
              </div>

              <div className="eb-grundare__text">
                <h2 className="text-[2rem] sm:text-[2.4rem]">{grundare.namn}</h2>
                <p className="mt-2 text-[0.9375rem]" style={{ color: 'var(--muted)' }}>
                  {grundare.roll}
                </p>
                <div className="mt-7 max-w-[56ch] space-y-5">
                  {grundare.stycken.map((p, i) => (
                    <p key={i} className="text-[1.0625rem] leading-[1.7]" style={{ color: '#31465a' }}>
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </Avslojad>
          </Spalt>
        </div>
      </section>

      {/* ---------- Kontakt ---------- */}
      <footer id="contact" style={{ background: 'var(--ink)' }} className="text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 lg:px-10">
          <Spalt spine={kontakt.spine} mork>
            <div className="max-w-[68ch]">
              <h2 className="max-w-[16ch] text-[2rem] sm:text-[2.75rem]">{kontakt.rubrik}</h2>
              <p className="mt-5 text-[1.0625rem] text-white/55">{kontakt.text}</p>

              <a
                href={`mailto:${kontakt.epost}`}
                className="mt-10 inline-block pb-1.5 text-[1.375rem] font-medium tracking-tight text-white"
                style={{ borderBottom: '1px solid var(--coral)' }}
              >
                {kontakt.epost}
              </a>

              <div className="mt-4 text-sm text-white/40">
                {kontakt.namn}, {kontakt.roll}
              </div>

              <div className="eb-hair-dark mt-20 pt-6 text-sm text-white/35">
                {kontakt.fotnot} —{' '}
                <a
                  href={`https://${kontakt.lank}`}
                  className="underline underline-offset-4"
                >
                  {kontakt.lank}
                </a>
              </div>
            </div>
          </Spalt>
        </div>
      </footer>
    </div>
  );
}
