import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FakturaRad {
  beskrivning: string;
  antal: number;
  enhet: string;
  apris: number;
  momssats: number;
}

export interface FakturaPDFData {
  faktura_nr: string;
  faktura_datum: string;
  forfallo_datum: string;
  // Säljare
  säljar_namn: string;
  säljar_foretag: string | null;
  säljar_org_nr: string | null;
  betalningsinfo: string | null;
  meddelande: string | null;
  // Kund
  kund_namn: string;
  kund_email: string | null;
  kund_adress: string | null;
  kund_postnummer: string | null;
  kund_ort: string | null;
  kund_land: string | null;
  kund_org_nr: string | null;
  // Rader
  rader: FakturaRad[];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', padding: 44, backgroundColor: '#ffffff' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoBox: { width: 22, height: 22, backgroundColor: CORAL, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  logoMuted: { color: '#94a3b8' },
  headerRight: { alignItems: 'flex-end' },
  fakturaNr: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: NAV_BG, marginBottom: 4 },
  badge: { backgroundColor: '#FEF9C3', color: '#A16207', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  // Parter
  parterRow: { flexDirection: 'row', gap: 20, marginBottom: 28 },
  partBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12 },
  partLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  partNamn: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 3 },
  partRad: { fontSize: 8, color: '#64748b', marginBottom: 1.5 },

  // Datumrad
  datumRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  datumBox: { flex: 1, borderTopWidth: 2, borderTopColor: NAV_BG, paddingTop: 8 },
  datumLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  datumVärde: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

  // Artikelrad
  tableHeader: { flexDirection: 'row', backgroundColor: NAV_BG, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, marginBottom: 2 },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  tableText: { fontSize: 8.5, color: '#334155' },
  tableTextRight: { fontSize: 8.5, color: '#334155', textAlign: 'right' },
  tableTextBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1e293b', textAlign: 'right' },

  // Kolumnbredder
  colBeskr: { flex: 3 },
  colAntal: { width: 36, textAlign: 'center' },
  colEnhet: { width: 28, textAlign: 'center' },
  colApris: { width: 60, textAlign: 'right' },
  colMoms: { width: 36, textAlign: 'center' },
  colSumma: { width: 60, textAlign: 'right' },

  // Summering
  sumRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  sumBox: { width: 220 },
  sumLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  sumLabel: { fontSize: 8.5, color: '#64748b' },
  sumVal: { fontSize: 8.5, color: '#1e293b', fontFamily: 'Helvetica-Bold' },
  sumDivider: { borderTopWidth: 1.5, borderTopColor: NAV_BG, marginVertical: 6 },
  sumTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAV_BG },
  sumTotalVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAV_BG },

  // Betalning + meddelande
  footer: { marginTop: 32, flexDirection: 'row', gap: 16 },
  footerBox: { flex: 1, borderTopWidth: 2, borderTopColor: '#E2E8F0', paddingTop: 10 },
  footerLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  footerText: { fontSize: 8.5, color: '#475569', lineHeight: 1.5 },

  // Sidfot
  pageFooter: { position: 'absolute', bottom: 24, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between' },
  pageFooterText: { fontSize: 7, color: '#CBD5E1' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

function fmtDatum(s: string) {
  return new Date(s).toLocaleDateString('sv-SE');
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function FakturaPDF({ data }: { data: FakturaPDFData }) {
  const radSummor = data.rader.map(r => {
    const exkl = r.antal * r.apris;
    const moms = exkl * (r.momssats / 100);
    return { exkl, moms, inkl: exkl + moms, momssats: r.momssats };
  });

  const totalExkl = radSummor.reduce((s, r) => s + r.exkl, 0);
  const totalInkl = radSummor.reduce((s, r) => s + r.inkl, 0);
  const momsByRate = [25, 12, 6].map(sats => ({
    sats,
    belopp: radSummor.filter(r => r.momssats === sats).reduce((acc, r) => acc + r.moms, 0),
  })).filter(m => m.belopp > 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.logo}>
            <View style={s.logoBox}>
              <Text style={{ fontSize: 9, color: 'white', fontFamily: 'Helvetica-Bold' }}>✓</Text>
            </View>
            <Text style={s.logoText}>
              <Text style={s.logoMuted}>Enkla </Text>Bokslut
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.fakturaNr}>FAKTURA</Text>
            <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 6 }}>Nr {data.faktura_nr}</Text>
            <View style={s.badge}><Text>OBETALD</Text></View>
          </View>
        </View>

        {/* Parter */}
        <View style={s.parterRow}>
          <View style={s.partBox}>
            <Text style={s.partLabel}>Från</Text>
            <Text style={s.partNamn}>{data.säljar_foretag ?? data.säljar_namn}</Text>
            {data.säljar_foretag && <Text style={s.partRad}>{data.säljar_namn}</Text>}
            {data.säljar_org_nr && <Text style={s.partRad}>Org-nr: {data.säljar_org_nr}</Text>}
          </View>
          <View style={s.partBox}>
            <Text style={s.partLabel}>Till</Text>
            <Text style={s.partNamn}>{data.kund_namn}</Text>
            {data.kund_org_nr && <Text style={s.partRad}>Org-nr: {data.kund_org_nr}</Text>}
            {data.kund_adress && <Text style={s.partRad}>{data.kund_adress}</Text>}
            {(data.kund_postnummer || data.kund_ort) && (
              <Text style={s.partRad}>{[data.kund_postnummer, data.kund_ort].filter(Boolean).join(' ')}</Text>
            )}
            {data.kund_land && data.kund_land !== 'Sverige' && <Text style={s.partRad}>{data.kund_land}</Text>}
            {data.kund_email && <Text style={s.partRad}>{data.kund_email}</Text>}
          </View>
        </View>

        {/* Datum */}
        <View style={s.datumRow}>
          <View style={s.datumBox}>
            <Text style={s.datumLabel}>Fakturadatum</Text>
            <Text style={s.datumVärde}>{fmtDatum(data.faktura_datum)}</Text>
          </View>
          <View style={s.datumBox}>
            <Text style={s.datumLabel}>Förfallodatum</Text>
            <Text style={s.datumVärde}>{fmtDatum(data.forfallo_datum)}</Text>
          </View>
          <View style={s.datumBox}>
            <Text style={s.datumLabel}>Fakturanummer</Text>
            <Text style={s.datumVärde}>{data.faktura_nr}</Text>
          </View>
          <View style={s.datumBox}>
            <Text style={s.datumLabel}>Betalningsvillkor</Text>
            <Text style={s.datumVärde}>
              {Math.round((new Date(data.forfallo_datum).getTime() - new Date(data.faktura_datum).getTime()) / 86400000)} dagar
            </Text>
          </View>
        </View>

        {/* Artiklar – header */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderText, s.colBeskr]}>Beskrivning</Text>
          <Text style={[s.tableHeaderText, s.colAntal, { textAlign: 'center' }]}>Antal</Text>
          <Text style={[s.tableHeaderText, s.colEnhet, { textAlign: 'center' }]}>Enhet</Text>
          <Text style={[s.tableHeaderText, s.colApris, { textAlign: 'right' }]}>À-pris</Text>
          <Text style={[s.tableHeaderText, s.colMoms, { textAlign: 'center' }]}>Moms</Text>
          <Text style={[s.tableHeaderText, s.colSumma, { textAlign: 'right' }]}>Summa</Text>
        </View>

        {/* Artiklar – rader */}
        {data.rader.map((rad, i) => {
          const exkl = rad.antal * rad.apris;
          return (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tableText, s.colBeskr]}>{rad.beskrivning}</Text>
              <Text style={[s.tableText, s.colAntal, { textAlign: 'center' }]}>{rad.antal}</Text>
              <Text style={[s.tableText, s.colEnhet, { textAlign: 'center' }]}>{rad.enhet}</Text>
              <Text style={[s.tableText, s.colApris, { textAlign: 'right' }]}>{fmt(rad.apris)}</Text>
              <Text style={[s.tableText, s.colMoms, { textAlign: 'center' }]}>{rad.momssats}%</Text>
              <Text style={[s.tableTextBold, s.colSumma]}>{fmt(exkl)}</Text>
            </View>
          );
        })}

        {/* Summering */}
        <View style={s.sumRow}>
          <View style={s.sumBox}>
            <View style={s.sumLine}>
              <Text style={s.sumLabel}>Belopp exkl. moms</Text>
              <Text style={s.sumVal}>{fmt(totalExkl)}</Text>
            </View>
            {momsByRate.map(m => (
              <View key={m.sats} style={s.sumLine}>
                <Text style={s.sumLabel}>Moms {m.sats}%</Text>
                <Text style={s.sumVal}>{fmt(m.belopp)}</Text>
              </View>
            ))}
            <View style={s.sumDivider} />
            <View style={s.sumLine}>
              <Text style={s.sumTotalLabel}>Totalt att betala</Text>
              <Text style={s.sumTotalVal}>{fmt(totalInkl)}</Text>
            </View>
          </View>
        </View>

        {/* Betalning + meddelande */}
        <View style={s.footer}>
          {data.betalningsinfo && (
            <View style={s.footerBox}>
              <Text style={s.footerLabel}>Betalningsinfo</Text>
              <Text style={s.footerText}>{data.betalningsinfo}</Text>
            </View>
          )}
          {data.meddelande && (
            <View style={s.footerBox}>
              <Text style={s.footerLabel}>Meddelande</Text>
              <Text style={s.footerText}>{data.meddelande}</Text>
            </View>
          )}
        </View>

        {/* Sidfot */}
        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>Enkla Bokslut · enklabokslut.se</Text>
          <Text style={s.pageFooterText} render={({ pageNumber, totalPages }) => `Sida ${pageNumber} av ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
