'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

interface FakturaRad {
  beskrivning: string;
  antal: number;
  enhet: string;
  apris: number;
  momssats: number;
}

interface Faktura {
  id: string;
  faktura_nr: string;
  faktura_datum: string;
  forfallo_datum: string;
  kund_namn: string;
  kund_email: string | null;
  kund_adress: string | null;
  kund_postnummer: string | null;
  kund_ort: string | null;
  kund_land: string | null;
  kund_org_nr: string | null;
  rader: FakturaRad[];
  belopp_exkl_moms: number;
  moms_belopp: number;
  belopp_inkl_moms: number;
  betalningsinfo: string | null;
  meddelande: string | null;
  status: string;
}

function fmt(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

function fmtDatum(s: string) {
  return new Date(s).toLocaleDateString('sv-SE');
}

export default function FakturaVyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [faktura, setFaktura] = useState<Faktura | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !id) return;
    async function fetch() {
      const supabase = createClient();
      const { data } = await supabase.from('fakturor').select('*').eq('id', id).single();
      if (data) setFaktura(data);
      setFetching(false);
    }
    fetch();
  }, [user, id]);

  if (loading || fetching) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!faktura) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-slate-50">
        <p className="text-slate-400">Fakturan hittades inte.</p>
      </div>
    );
  }

  const rader = faktura.rader ?? [];
  const totalExkl = rader.reduce((s, r) => s + r.antal * r.apris, 0);
  const momsByRate = [25, 12, 6].map(sats => ({
    sats,
    belopp: rader.filter(r => r.momssats === sats).reduce((acc, r) => acc + r.antal * r.apris * (sats / 100), 0),
  })).filter(m => m.belopp > 0);
  const totalInkl = totalExkl + momsByRate.reduce((s, m) => s + m.belopp, 0);

  const betalningsDagar = Math.round(
    (new Date(faktura.forfallo_datum).getTime() - new Date(faktura.faktura_datum).getTime()) / 86400000
  );

  return (
    <>
<div className="flex flex-col min-h-full bg-slate-50">

        {/* Kontrollpanel */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/fakturor')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka
          </button>
          <button
            onClick={async () => {
              const el = document.getElementById('faktura-innehall');
              if (!el) return;
              const { default: html2canvas } = await import('html2canvas');
              const { default: jsPDF } = await import('jspdf');
              const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
              const pdfW = pdf.internal.pageSize.getWidth();
              const pdfH = (canvas.height * pdfW) / canvas.width;
              pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
              pdf.save(`Faktura-${faktura.faktura_nr}.pdf`);
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
            style={{ backgroundColor: NAV_BG }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ladda ner PDF
          </button>
        </div>

        {/* Fakturavy */}
        <div className="px-8 pb-16">
          <div id="faktura-innehall" className="bg-white rounded-2xl border border-slate-200 p-12 max-w-3xl mx-auto shadow-sm">
            <FakturaInnehall
              faktura={faktura}
              rader={rader}
              totalExkl={totalExkl}
              momsByRate={momsByRate}
              totalInkl={totalInkl}
              betalningsDagar={betalningsDagar}
              profile={profile}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function FakturaInnehall({
  faktura, rader, totalExkl, momsByRate, totalInkl, betalningsDagar, profile,
}: {
  faktura: Faktura;
  rader: FakturaRad[];
  totalExkl: number;
  momsByRate: { sats: number; belopp: number }[];
  totalInkl: number;
  betalningsDagar: number;
  profile: { full_name: string | null; company_name: string | null; org_nr: string | null } | null;
}) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, backgroundColor: CORAL, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>✓</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>Enkla </span>Bokslut
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: NAV_BG, letterSpacing: '-0.5px' }}>FAKTURA</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Nr {faktura.faktura_nr}</div>
          <div style={{
            display: 'inline-block', marginTop: 8,
            backgroundColor: faktura.status === 'betald' ? '#DCFCE7' : '#FEF9C3',
            color: faktura.status === 'betald' ? '#166534' : '#A16207',
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
          }}>
            {faktura.status === 'betald' ? 'BETALD' : 'OBETALD'}
          </div>
        </div>
      </div>

      {/* Parter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Från</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{profile?.company_name ?? profile?.full_name ?? ''}</div>
          {profile?.company_name && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{profile.full_name}</div>}
          {profile?.org_nr && <div style={{ fontSize: 12, color: '#64748b' }}>Org-nr: {profile.org_nr}</div>}
        </div>
        <div style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Till</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{faktura.kund_namn}</div>
          {faktura.kund_org_nr && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Org-nr: {faktura.kund_org_nr}</div>}
          {faktura.kund_adress && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{faktura.kund_adress}</div>}
          {(faktura.kund_postnummer || faktura.kund_ort) && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
              {[faktura.kund_postnummer, faktura.kund_ort].filter(Boolean).join(' ')}
            </div>
          )}
          {faktura.kund_email && <div style={{ fontSize: 12, color: '#64748b' }}>{faktura.kund_email}</div>}
        </div>
      </div>

      {/* Datumrad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginBottom: 28, borderTop: `2px solid ${NAV_BG}`, paddingTop: 12 }}>
        {[
          ['Fakturadatum', fmtDatum(faktura.faktura_datum)],
          ['Förfallodatum', fmtDatum(faktura.forfallo_datum)],
          ['Fakturanummer', faktura.faktura_nr],
          ['Betalningsvillkor', `${betalningsDagar} dagar`],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Artikelrader */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ backgroundColor: NAV_BG }}>
            {['Beskrivning', 'Antal', 'Enhet', 'À-pris', 'Moms', 'Summa exkl. moms'].map((h, i) => (
              <th key={h} style={{
                padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'white',
                textAlign: i > 1 ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rader.map((r, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#F8FAFC' : 'white' }}>
              <td style={{ padding: '8px 10px', fontSize: 12 }}>{r.beskrivning}</td>
              <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right' }}>{r.antal}</td>
              <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right' }}>{r.enhet}</td>
              <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right' }}>{fmt(r.apris)}</td>
              <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right' }}>{r.momssats}%</td>
              <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{fmt(r.antal * r.apris)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summering */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
        <div style={{ width: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, color: '#64748b' }}>
            <span>Belopp exkl. moms</span><span style={{ fontWeight: 600, color: '#1e293b' }}>{fmt(totalExkl)}</span>
          </div>
          {momsByRate.map(m => (
            <div key={m.sats} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, color: '#64748b' }}>
              <span>Moms {m.sats}%</span><span style={{ fontWeight: 600, color: '#1e293b' }}>{fmt(m.belopp)}</span>
            </div>
          ))}
          <div style={{ borderTop: `2px solid ${NAV_BG}`, marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: NAV_BG }}>Totalt att betala</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: NAV_BG }}>{fmt(totalInkl)}</span>
          </div>
        </div>
      </div>

      {/* Betalning + meddelande */}
      {(faktura.betalningsinfo || faktura.meddelande) && (
        <div style={{ display: 'grid', gridTemplateColumns: faktura.betalningsinfo && faktura.meddelande ? '1fr 1fr' : '1fr', gap: 16, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
          {faktura.betalningsinfo && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Betalningsinfo</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{faktura.betalningsinfo}</div>
            </div>
          )}
          {faktura.meddelande && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Meddelande</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{faktura.meddelande}</div>
            </div>
          )}
        </div>
      )}

      {/* Sidfot */}
      <div style={{ marginTop: 48, paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#CBD5E1' }}>
        <span>Enkla Bokslut · enklabokslut.se</span>
        <span>Faktura {faktura.faktura_nr}</span>
      </div>
    </div>
  );
}
