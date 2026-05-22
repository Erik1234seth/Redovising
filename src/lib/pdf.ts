import { jsPDF } from 'jspdf';
import { fmtKr } from './rapporter';

const NAV_BG: [number, number, number] = [23, 59, 87];
const CORAL: [number, number, number] = [233, 92, 99];
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_400: [number, number, number] = [148, 163, 184];
const SLATE_100: [number, number, number] = [241, 245, 249];
const WHITE: [number, number, number] = [255, 255, 255];
const EMERALD: [number, number, number] = [5, 150, 105];
const RED: [number, number, number] = [239, 68, 68];

function createDoc() {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...NAV_BG);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 13);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, 21);
  doc.text('Enkla Bokslut', 196, 13, { align: 'right' });
  doc.text(new Date().toLocaleDateString('sv-SE'), 196, 21, { align: 'right' });
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...SLATE_100);
    doc.line(14, 284, 196, 284);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_400);
    doc.text('Genererad av Enkla Bokslut · app.enklabokslut.se', 14, 289);
    doc.text(`Sida ${i} av ${pageCount}`, 196, 289, { align: 'right' });
  }
}

function drawSectionHeader(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...SLATE_100);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE_400);
  doc.text(text.toUpperCase(), 17, y + 5);
  return y + 7;
}

function drawTableRow(
  doc: jsPDF,
  left: string,
  right: string,
  y: number,
  opts: { bold?: boolean; valueColor?: [number, number, number]; shade?: boolean } = {}
): number {
  if (opts.shade) {
    doc.setFillColor(...SLATE_100);
    doc.rect(14, y, 182, 7.5, 'F');
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setTextColor(...(opts.bold ? SLATE_700 : [71, 85, 105] as [number,number,number]));
  doc.text(left, 17, y + 5.5);
  doc.setTextColor(...(opts.valueColor ?? (opts.bold ? SLATE_700 : [71, 85, 105] as [number,number,number])));
  doc.text(right, 193, y + 5.5, { align: 'right' });
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y + 7.5, 196, y + 7.5);
  return y + 7.5;
}

function drawTotalRow(doc: jsPDF, left: string, right: string, y: number, color: [number,number,number] = NAV_BG): number {
  doc.setFillColor(...color);
  doc.rect(14, y, 182, 9, 'F');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(left, 17, y + 6.5);
  doc.text(right, 193, y + 6.5, { align: 'right' });
  return y + 9;
}

// ─── Resultatrapport ───────────────────────────────────────────────────────────
export function exportResultatrapportPDF(data: {
  intäkterRader: { namn: string; belopp: number }[];
  kostnadRader: { namn: string; belopp: number }[];
  sumIntäkter: number;
  sumKostnader: number;
  rörelseresultat: number;
}, period: string) {
  const doc = createDoc();
  drawHeader(doc, 'Resultatrapport', period);

  let y = 36;

  y = drawSectionHeader(doc, 'Intäkter', y);
  for (const r of data.intäkterRader) {
    if (y > 270) { doc.addPage(); y = 14; }
    y = drawTableRow(doc, r.namn, fmtKr(r.belopp), y);
  }
  y = drawTotalRow(doc, 'Summa intäkter', fmtKr(data.sumIntäkter), y + 1);

  y += 6;
  y = drawSectionHeader(doc, 'Kostnader', y);
  for (const r of data.kostnadRader) {
    if (y > 270) { doc.addPage(); y = 14; }
    y = drawTableRow(doc, r.namn, fmtKr(r.belopp), y);
  }
  y = drawTotalRow(doc, 'Summa kostnader', fmtKr(data.sumKostnader), y + 1);

  y += 6;
  const resColor: [number,number,number] = data.rörelseresultat >= 0 ? EMERALD : CORAL;
  drawTotalRow(doc, 'Rörelseresultat', fmtKr(data.rörelseresultat), y, resColor);

  drawFooter(doc);
  doc.save(`Resultatrapport_${period.replace(/\s/g, '_')}.pdf`);
}

// ─── Balansrapport ─────────────────────────────────────────────────────────────
export function exportBalansrapportPDF(data: {
  tillgångar: { konto: string; namn: string; saldo: number }[];
  skulderEK: { konto: string; namn: string; saldo: number }[];
  periodresltat: number;
  sumTillgångar: number;
  sumSkulderEKMedResultat: number;
  year: number;
}) {
  const doc = createDoc();
  drawHeader(doc, 'Balansrapport', `Räkenskapsår ${data.year} · ${new Date().toLocaleDateString('sv-SE')}`);

  let y = 36;

  // Tillgångar
  y = drawSectionHeader(doc, 'Anläggningstillgångar (1000–1499)', y);
  const anlagg = data.tillgångar.filter(k => parseInt(k.konto) < 1500);
  for (const k of anlagg) {
    if (y > 270) { doc.addPage(); y = 14; }
    y = drawTableRow(doc, `${k.konto}  ${k.namn}`, fmtKr(k.saldo), y);
  }

  y += 3;
  y = drawSectionHeader(doc, 'Omsättningstillgångar (1500–1999)', y);
  const omsTillg = data.tillgångar.filter(k => parseInt(k.konto) >= 1500);
  for (const k of omsTillg) {
    if (y > 270) { doc.addPage(); y = 14; }
    y = drawTableRow(doc, `${k.konto}  ${k.namn}`, fmtKr(k.saldo), y);
  }
  y = drawTotalRow(doc, 'Summa tillgångar', fmtKr(data.sumTillgångar), y + 1);

  y += 8;

  // Skulder & EK
  y = drawSectionHeader(doc, 'Eget kapital (2000–2099)', y);
  const ek = data.skulderEK.filter(k => parseInt(k.konto) < 2100);
  for (const k of ek) {
    if (y > 270) { doc.addPage(); y = 14; }
    y = drawTableRow(doc, `${k.konto}  ${k.namn}`, fmtKr(k.saldo), y);
  }

  y += 3;
  y = drawSectionHeader(doc, 'Kortfristiga skulder (2100–2999)', y);
  const skulder = data.skulderEK.filter(k => parseInt(k.konto) >= 2100);
  for (const k of skulder) {
    if (y > 270) { doc.addPage(); y = 14; }
    y = drawTableRow(doc, `${k.konto}  ${k.namn}`, fmtKr(k.saldo), y);
  }

  if (data.periodresltat !== 0) {
    y = drawTableRow(doc, 'Årets resultat (ej bokfört)', fmtKr(data.periodresltat), y, {
      valueColor: data.periodresltat >= 0 ? EMERALD : RED,
    });
  }

  drawTotalRow(doc, 'Summa skulder & eget kapital', fmtKr(data.sumSkulderEKMedResultat), y + 1);

  drawFooter(doc);
  doc.save(`Balansrapport_${data.year}.pdf`);
}

// ─── Momsredovisning ───────────────────────────────────────────────────────────
export function exportMomsredovisningPDF(data: {
  utgåendeMoms: number;
  ingåendeMoms: number;
  netto: number;
  moms25: number;
  moms12: number;
  moms6: number;
}, period: string) {
  const doc = createDoc();
  drawHeader(doc, 'Momsredovisning', period);

  let y = 36;

  y = drawSectionHeader(doc, 'Utgående moms', y);
  y = drawTableRow(doc, 'Ruta 05 — Utgående moms 25%', fmtKr(data.moms25), y);
  y = drawTableRow(doc, 'Ruta 06 — Utgående moms 12%', fmtKr(data.moms12), y);
  y = drawTableRow(doc, 'Ruta 07 — Utgående moms 6%', fmtKr(data.moms6), y);
  y = drawTotalRow(doc, 'Summa utgående moms', fmtKr(data.utgåendeMoms), y + 1);

  y += 6;
  y = drawSectionHeader(doc, 'Ingående moms', y);
  y = drawTableRow(doc, 'Ruta 48 — Ingående moms', fmtKr(data.ingåendeMoms), y);
  y = drawTotalRow(doc, 'Summa ingående moms', fmtKr(data.ingåendeMoms), y + 1);

  y += 8;
  const nettoColor: [number,number,number] = data.netto <= 0 ? EMERALD : CORAL;
  drawTotalRow(doc, data.netto <= 0 ? 'Moms att få tillbaka' : 'Moms att betala', fmtKr(Math.abs(data.netto)), y, nettoColor);

  drawFooter(doc);
  doc.save(`Momsredovisning_${period.replace(/\s/g, '_')}.pdf`);
}

// ─── NE-bilaga ─────────────────────────────────────────────────────────────────
export function exportNEBilagaPDF(rows: { kod: string; label: string; value: number; bold?: boolean }[], year: number) {
  const doc = createDoc();
  drawHeader(doc, 'NE-bilaga', `Räkenskapsår ${year}`);

  let y = 36;
  y = drawSectionHeader(doc, 'Resultaträkning', y);

  for (const row of rows) {
    const valueColor: [number,number,number] | undefined = row.bold
      ? (row.value >= 0 ? EMERALD : CORAL)
      : undefined;
    y = drawTableRow(doc, `${row.kod.padEnd(4)}  ${row.label}`, fmtKr(row.value), y, {
      bold: row.bold,
      valueColor,
      shade: row.bold,
    });
  }

  y += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_400);
  doc.text('Denna NE-bilaga är preliminär och ska granskas av en revisor innan inlämning till Skatteverket.', 14, y);

  drawFooter(doc);
  doc.save(`NE-bilaga_${year}.pdf`);
}

// ─── Kontosaldo ────────────────────────────────────────────────────────────────
export function exportKontosaldoPDF(
  grupper: Record<string, { konto: string; namn: string; saldo: number; debet: number; kredit: number }[]>,
  year: number
) {
  const doc = createDoc();
  drawHeader(doc, 'Kontosaldo', `Per ${new Date().toLocaleDateString('sv-SE')} · ${year}`);

  let y = 36;

  for (const [klass, kontor] of Object.entries(grupper).sort()) {
    if (y > 260) { doc.addPage(); y = 14; }
    y = drawSectionHeader(doc, `Klass ${klass}`, y);
    for (const k of kontor) {
      if (y > 270) { doc.addPage(); y = 14; }
      // Draw konto + namn on left, Dr/Cr small, saldo right
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`${k.konto}  ${k.namn}`, 17, y + 5.5);
      doc.setFontSize(7);
      doc.setTextColor(...SLATE_400);
      doc.text(`Dr ${fmtKr(k.debet)} / Cr ${fmtKr(k.kredit)}`, 120, y + 5.5);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SLATE_700);
      doc.text(fmtKr(k.saldo), 193, y + 5.5, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 7.5, 196, y + 7.5);
      y += 7.5;
    }
    y += 2;
  }

  drawFooter(doc);
  doc.save(`Kontosaldo_${year}.pdf`);
}

// ─── Transaktionslista ─────────────────────────────────────────────────────────
export function exportTransaktionslistaPDF(
  transaktioner: { datum: string; beskrivning: string; belopp: number; haendelse_typ: string; ai_debit_konto?: string | null; ai_kredit_konto?: string | null }[],
  period: string
) {
  const doc = createDoc();
  drawHeader(doc, 'Transaktionslista', period);

  let y = 36;
  y = drawSectionHeader(doc, `${transaktioner.length} transaktioner`, y);

  for (const t of transaktioner) {
    if (y > 272) { doc.addPage(); y = 14; }
    const isIn = t.haendelse_typ === 'kund-betalat';
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(t.datum, 17, y + 5.5);
    const desc = t.beskrivning.length > 55 ? t.beskrivning.slice(0, 55) + '…' : t.beskrivning;
    doc.text(desc, 42, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(isIn ? EMERALD : RED));
    doc.text((isIn ? '+' : '-') + fmtKr(Math.abs(t.belopp)), 193, y + 5.5, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 7.5, 196, y + 7.5);
    y += 7.5;
  }

  drawFooter(doc);
  doc.save(`Transaktionslista_${period.replace(/\s/g, '_')}.pdf`);
}
