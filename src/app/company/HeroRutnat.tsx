'use client';

import { useEffect, useRef } from 'react';

/**
 * Heroyns bakgrund utan film: plattformen i arbete, berättad med rutor.
 *
 * Rutorna är samma formspråk som figurerna längre ner på sidan, så heron
 * hänger ihop med resten. Men i stället för att bara glittra berättar den
 * vad Sethapp gör, i en slinga på ungefär tjugo sekunder:
 *
 *  1. Underlag kommer in. Kvitton och fakturor glider in från höger, lite
 *     snett, som papper gör.
 *  2. De läses. En korallfärgad linje sveper över dokumentet uppifrån och ner.
 *  3. De struktureras. Dokumentet löses upp i rutor som flyger in och landar
 *     på sin rad i en huvudbok — beloppet alltid i högerkolumnen, så en
 *     summakolumn växer fram.
 *  4. Bokslut. När boken är full går en våg genom raderna, en ram ritas runt
 *     den, rutorna fylls till ett helt block — samma ram som i figuren
 *     "Focused market" — och sedan töms den och allt börjar om.
 *
 * Runt huvudboken ligger ett svagt rutnät med ett långsamt ljussvep, och
 * rutorna under muspekaren lyser upp lite, så heron svarar när man rör sig.
 *
 * Huvudboken placeras till höger om textkolumnen och räknas om vid varje
 * storleksändring. På smala skärmar, där texten tar hela bredden, visas bara
 * rutnätet.
 *
 * Animationen har en egen klocka som bara går när den ritas, så en flik som
 * legat i bakgrunden fortsätter där den var i stället för att hoppa. Den
 * pausar när heron är utanför skärmen, och har besökaren bett om mindre
 * rörelse ritas en stillbild av en halvfull huvudbok.
 */

const RUTA = 22;
const GAP = 3;
const STEG = RUTA + GAP;

/**
 * Sidans innehållsbredd (max-w-6xl) och hur långt in texten når. Rubriken
 * slutar ungefär vid 72 % av spalten, räknat med ledtexten i marginalen.
 */
const SPALT = 1152;
const TEXTANDEL = 0.74;

const DOK_IN = 1800;
const DOK_SKANN = 650;
const DOK_UT = 450;
const FLYGTID = 850;
const FLYG_FORSKJUTNING = 45;

type Dok = {
  start: number;
  rad: number;
  langd: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vrid: number;
  franY: number;
  linjer: number[];
  sprangd: boolean;
};

type Partikel = {
  start: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  index: number;
  belopp: boolean;
};

type Post = { i: number; start: number; livslangd: number; korall: boolean };

const klamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const utBroms = (p: number) => 1 - Math.pow(1 - p, 3);
const mjuk = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export default function HeroRutnat() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stilla = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Mått ----
    let W = 0;
    let H = 0;
    let kolumner = 0;
    let rader = 0;
    let bas = new Float32Array(0);

    // Huvudboken, i rutkoordinater.
    let berattelse = false;
    let hx = 0;
    let hy = 0;
    let hk = 0; // kolumner
    let hr = 0; // rader
    let bokad = new Float32Array(0); // klockslag då rutan landade, 0 = tom
    let beloppsruta = new Uint8Array(0);

    // ---- Tillstånd ----
    let klocka = 0;
    let senast = 0;
    let dokument: Dok[] = [];
    let partiklar: Partikel[] = [];
    let poster: Post[] = [];
    let nastaRad = 0;
    let nastaDok = 900;
    let nastaPost = 0;
    let senasteLandning = 0;
    let stangStart = -1;

    let mus: { x: number; y: number } | null = null;
    let bildruta = 0;
    let synlig = true;

    const nollstallBok = () => {
      bokad = new Float32Array(hk * hr);
      beloppsruta = new Uint8Array(hk * hr);
      dokument = [];
      partiklar = [];
      nastaRad = 0;
      stangStart = -1;
      nastaDok = klocka + 900;
    };

    const anpassa = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      kolumner = Math.ceil(W / STEG) + 1;
      rader = Math.ceil(H / STEG) + 1;
      bas = new Float32Array(kolumner * rader);
      for (let i = 0; i < bas.length; i++) bas[i] = 0.022 + Math.random() * 0.03;

      // Huvudboken ligger till höger om textkolumnen och lämnar plats för
      // dokumenten som kommer in längst ut till höger.
      const spalt = Math.min(W, SPALT);
      const textSlut = (W - spalt) / 2 + spalt * TEXTANDEL;
      const start = Math.max(textSlut + 2 * STEG, W * 0.5);
      const intag = 6 * STEG;
      hk = Math.min(16, Math.floor((W - start - intag) / STEG));
      hr = Math.max(5, Math.min(10, Math.floor((H * 0.46) / STEG)));
      berattelse = hk >= 8 && W >= 900;

      if (berattelse) {
        const over = W - start - intag - hk * STEG;
        hx = Math.round((start + over * 0.35) / STEG);
        hy = Math.round((H / 2 - (hr * STEG) / 2) / STEG);
      }

      nollstallBok();
      poster = [];

      if (stilla && berattelse) {
        // Stillbilden: en halvfull bok, landad sedan länge.
        for (let r = 0; r < Math.ceil(hr * 0.6); r++) {
          const langd = 3 + Math.floor(Math.random() * (hk - 4));
          for (let k = 0; k < langd - 1; k++) bokad[r * hk + k] = -10000;
          bokad[r * hk + hk - 1] = -10000;
          beloppsruta[r * hk + hk - 1] = 1;
        }
      }
    };

    const iBok = (x: number, y: number) =>
      berattelse && x >= hx && x < hx + hk && y >= hy && y < hy + hr;

    // ---- Händelser ----

    const nyttDokument = () => {
      const rad = nastaRad++;
      const langd = 3 + Math.floor(Math.random() * (hk - 3));
      const w = 62 + Math.random() * 22;
      const h = 82 + Math.random() * 24;
      const hogerKant = (hx + hk) * STEG;
      const utrymme = Math.max(0, W - hogerKant - 2 * STEG - w - 24);
      const radMitt = (hy + rad) * STEG + RUTA / 2;
      const y = klamp(radMitt - h / 2 + (Math.random() - 0.5) * 40, 70, H - h - 40);

      dokument.push({
        start: klocka,
        rad,
        langd,
        x: hogerKant + 2 * STEG + Math.random() * utrymme,
        y,
        w,
        h,
        vrid: (Math.random() - 0.5) * 0.35,
        franY: y + (Math.random() - 0.5) * 120,
        linjer: Array.from({ length: 4 + Math.floor(Math.random() * 3) }, () => 0.35 + Math.random() * 0.55),
        sprangd: false,
      });
      nastaDok = klocka + 1150 + Math.random() * 700;
    };

    const sprang = (d: Dok) => {
      d.sprangd = true;
      // Beskrivningen fyller raden från vänster, beloppet hamnar längst ut.
      const mal: { k: number; belopp: boolean }[] = [];
      for (let k = 0; k < d.langd - 1; k++) mal.push({ k, belopp: false });
      mal.push({ k: hk - 1, belopp: true });

      mal.forEach((m, n) => {
        partiklar.push({
          start: klocka + n * FLYG_FORSKJUTNING,
          sx: d.x + 10 + Math.random() * (d.w - 20),
          sy: d.y + 14 + Math.random() * (d.h - 28),
          tx: (hx + m.k) * STEG,
          ty: (hy + d.rad) * STEG,
          index: d.rad * hk + m.k,
          belopp: m.belopp,
        });
      });
    };

    const uppdatera = () => {
      if (!berattelse) return;

      if (stangStart < 0) {
        if (nastaRad < hr && klocka >= nastaDok && dokument.length < 3) nyttDokument();

        for (const d of dokument) {
          if (!d.sprangd && klocka - d.start >= DOK_IN + DOK_SKANN) sprang(d);
        }
        dokument = dokument.filter((d) => klocka - d.start < DOK_IN + DOK_SKANN + DOK_UT);

        partiklar = partiklar.filter((p) => {
          if (klocka - p.start < FLYGTID) return true;
          bokad[p.index] = klocka;
          beloppsruta[p.index] = p.belopp ? 1 : 0;
          senasteLandning = klocka;
          return false;
        });

        const klar = nastaRad >= hr && dokument.length === 0 && partiklar.length === 0;
        if (klar && klocka - senasteLandning > 900) stangStart = klocka;
      } else if (klocka - stangStart > 5200) {
        nollstallBok();
      }
    };

    // ---- Ritning ----

    const ritaRuta = (x: number, y: number, r: number, g: number, b: number, a: number, storlek = RUTA) => {
      if (a <= 0.005) return;
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a)})`;
      const forskj = (RUTA - storlek) / 2;
      ctx.fillRect(x + forskj, y + forskj, storlek, storlek);
    };

    const ritaBakgrund = () => {
      if (!stilla && klocka >= nastaPost) {
        let i = Math.floor(Math.random() * kolumner * rader);
        if (iBok(i % kolumner, Math.floor(i / kolumner))) i = -1;
        if (i >= 0) {
          poster.push({
            i,
            start: klocka,
            livslangd: 2400 + Math.random() * 2000,
            korall: Math.random() < 1 / 14,
          });
        }
        nastaPost = klocka + 260 + Math.random() * 380;
      }

      const tand = new Float32Array(kolumner * rader);
      const korall = new Uint8Array(kolumner * rader);
      poster = poster.filter((p) => {
        const alder = (klocka - p.start) / p.livslangd;
        if (alder >= 1) return false;
        const v = alder < 0.12 ? alder / 0.12 : 1 - (alder - 0.12) / 0.88;
        tand[p.i] = Math.max(tand[p.i], v * 0.4);
        if (p.korall) korall[p.i] = 1;
        return true;
      });

      const svep = klocka * 0.00012;
      for (let y = 0; y < rader; y++) {
        for (let x = 0; x < kolumner; x++) {
          if (iBok(x, y)) continue;
          const i = y * kolumner + x;
          const px = x * STEG;
          const py = y * STEG;

          const v1 = Math.sin((x * 0.9 + y * 0.45) * 0.09 - svep * 6);
          const v2 = Math.sin((x * 0.3 - y * 0.8) * 0.06 + svep * 3.4);
          let a = bas[i] + Math.max(0, v1 * 0.6 + v2 * 0.4) ** 3 * 0.08;

          if (mus) {
            const dx = px + RUTA / 2 - mus.x;
            const dy = py + RUTA / 2 - mus.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 170) a += (1 - d / 170) ** 2 * 0.16;
          }

          if (tand[i] > 0.01) {
            if (korall[i]) ritaRuta(px, py, 233, 92, 99, a + tand[i]);
            else ritaRuta(px, py, 127, 179, 217, a + tand[i]);
          } else {
            ritaRuta(px, py, 160, 196, 224, a);
          }
        }
      }
    };

    const ritaBok = () => {
      const s = stangStart < 0 ? -1 : klocka - stangStart;
      const tona = s < 0 ? 1 : 1 - klamp((s - 3900) / 1000);
      const left = hx * STEG;
      const top = hy * STEG;

      // Radlinjerna: huvudbokens linjering.
      ctx.fillStyle = `rgba(160,196,224,${0.07 * tona})`;
      for (let r = 1; r < hr; r++) ctx.fillRect(left, top + r * STEG - GAP / 2 - 0.5, hk * STEG - GAP, 1);
      // Och strecket före summakolumnen.
      ctx.fillStyle = `rgba(233,92,99,${0.22 * tona})`;
      ctx.fillRect(left + (hk - 1) * STEG - GAP / 2 - 0.5, top, 1, hr * STEG - GAP);

      for (let r = 0; r < hr; r++) {
        for (let k = 0; k < hk; k++) {
          const i = r * hk + k;
          const px = left + k * STEG;
          const py = top + r * STEG;
          const t = bokad[i];

          if (s >= 0) {
            // Bokslut: vågen, sedan fylls hela blocket.
            const vag = s < 1500 && t !== 0 ? Math.max(0, 1 - Math.abs(s - k * 55) / 260) * 0.45 : 0;
            const fyll = mjuk(klamp((s - 1500 - (k + r) * 22) / 520));
            const ljus = t !== 0 ? (beloppsruta[i] ? 0.8 : 0.5) : 0.05;
            const a = (ljus + vag) * (1 - fyll) + 0.9 * fyll;

            if (fyll > 0.02) {
              ritaRuta(px, py, 58, 124, 176, a * tona);
            } else if (beloppsruta[i]) {
              ritaRuta(px, py, 233, 92, 99, a * tona);
            } else {
              ritaRuta(px, py, 127, 179, 217, a * tona);
            }
            continue;
          }

          if (t === 0) {
            ritaRuta(px, py, 160, 196, 224, 0.07);
          } else {
            const blixt = Math.max(0, 1 - (klocka - t) / 550);
            if (beloppsruta[i]) ritaRuta(px, py, 233, 92, 99, 0.85 + blixt * 0.15);
            else ritaRuta(px, py, 127, 179, 217, 0.6 + blixt * 0.4);
          }
        }
      }

      if (s >= 0) {
        // Ramen runt det avslutade blocket ritas som en linje som går runt.
        const p = mjuk(klamp((s - 600) / 1100));
        if (p > 0) {
          const pad = 7;
          const w = hk * STEG - GAP + pad * 2;
          const h = hr * STEG - GAP + pad * 2;
          const omkrets = 2 * (w + h);
          ctx.save();
          ctx.strokeStyle = `rgba(233,92,99,${0.95 * tona})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([omkrets * p, omkrets]);
          ctx.strokeRect(left - pad, top - pad, w, h);
          ctx.restore();
        }
      }
    };

    const ritaDokument = () => {
      for (const d of dokument) {
        const alder = klocka - d.start;
        const inP = utBroms(klamp(alder / DOK_IN));
        const utP = klamp((alder - DOK_IN - DOK_SKANN) / DOK_UT);
        const a = klamp(alder / 400) * (1 - utP);
        if (a <= 0) continue;

        const x = W + 40 + (d.x - W - 40) * inP;
        const y = d.franY + (d.y - d.franY) * inP;
        const vrid = d.vrid * (1 - inP);
        const skala = 1 - utP * 0.12;

        ctx.save();
        ctx.translate(x + d.w / 2, y + d.h / 2);
        ctx.rotate(vrid);
        ctx.scale(skala, skala);
        ctx.translate(-d.w / 2, -d.h / 2);

        ctx.fillStyle = `rgba(205,222,236,${0.09 * a})`;
        ctx.fillRect(0, 0, d.w, d.h);
        ctx.strokeStyle = `rgba(205,222,236,${0.38 * a})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, d.w - 1, d.h - 1);

        // Textrader: rubrik, några rader, och ett belopp nere till höger.
        const skannP = klamp((alder - DOK_IN) / DOK_SKANN);
        const skannY = skannP * d.h;
        ctx.fillStyle = `rgba(205,222,236,${0.5 * a})`;
        ctx.fillRect(9, 11, (d.w - 18) * 0.55, 3);
        d.linjer.forEach((l, n) => {
          const ly = 24 + n * 9;
          if (ly > d.h - 22) return;
          const last = skannP > 0 && ly < skannY;
          ctx.fillStyle = last
            ? `rgba(127,179,217,${0.75 * a})`
            : `rgba(205,222,236,${0.22 * a})`;
          ctx.fillRect(9, ly, (d.w - 18) * l, 2);
        });
        ctx.fillStyle = `rgba(233,92,99,${(skannP >= 1 ? 0.9 : 0.45) * a})`;
        ctx.fillRect(d.w - 9 - 18, d.h - 14, 18, 3);

        // Läslinjen.
        if (skannP > 0 && skannP < 1) {
          ctx.fillStyle = `rgba(233,92,99,${0.9 * a})`;
          ctx.fillRect(-4, skannY, d.w + 8, 1.5);
          ctx.fillStyle = `rgba(233,92,99,${0.12 * a})`;
          ctx.fillRect(0, Math.max(0, skannY - 16), d.w, Math.min(16, skannY));
        }
        ctx.restore();
      }
    };

    const ritaPartiklar = () => {
      for (const p of partiklar) {
        const q = (klocka - p.start) / FLYGTID;
        if (q < 0) continue;
        const e = mjuk(klamp(q));
        const x = p.sx + (p.tx - p.sx) * e;
        const y = p.sy + (p.ty - p.sy) * e - Math.sin(Math.PI * e) * 26;
        const storlek = 8 + (RUTA - 8) * e;
        if (p.belopp) ritaRuta(x, y, 233, 92, 99, 0.95, storlek);
        else ritaRuta(x, y, 190, 218, 238, 0.9, storlek);
      }
    };

    const rita = () => {
      ctx.clearRect(0, 0, W, H);
      ritaBakgrund();
      if (berattelse) {
        ritaBok();
        ritaDokument();
        ritaPartiklar();
      }
    };

    // ---- Slinga ----

    const loop = (nu: number) => {
      // Egen klocka: ett stort hopp (efter en bakgrundsflik) räknas som ett
      // vanligt steg, så berättelsen fortsätter där den var.
      klocka += senast ? Math.min(nu - senast, 50) : 16;
      senast = nu;
      uppdatera();
      rita();
      if (synlig && !document.hidden) bildruta = requestAnimationFrame(loop);
    };

    const starta = () => {
      cancelAnimationFrame(bildruta);
      senast = 0;
      if (stilla) {
        rita();
        return;
      }
      if (synlig && !document.hidden) bildruta = requestAnimationFrame(loop);
    };

    anpassa();
    starta();

    const storlek = new ResizeObserver(() => {
      anpassa();
      if (stilla) rita();
    });
    storlek.observe(canvas);

    const betraktad = new IntersectionObserver(([entry]) => {
      synlig = entry.isIntersecting;
      starta();
    });
    betraktad.observe(canvas);

    const flik = () => starta();
    document.addEventListener('visibilitychange', flik);

    // Canvasen tar inte emot pekaren (texten ovanpå ska gå att markera),
    // så positionen läses från fönstret och räknas om till canvasens yta.
    const pekare = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mus = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null;
    };
    const lamna = () => {
      mus = null;
    };
    if (!stilla) {
      window.addEventListener('pointermove', pekare, { passive: true });
      document.addEventListener('pointerleave', lamna);
    }

    return () => {
      cancelAnimationFrame(bildruta);
      storlek.disconnect();
      betraktad.disconnect();
      document.removeEventListener('visibilitychange', flik);
      window.removeEventListener('pointermove', pekare);
      document.removeEventListener('pointerleave', lamna);
    };
  }, []);

  return <canvas ref={canvasRef} className="eb-hero__rutnat" aria-hidden="true" />;
}
