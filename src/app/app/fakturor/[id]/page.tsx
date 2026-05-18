'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

const NAV_BG = '#173b57';

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
  leverans_datum: string | null;
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
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);

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
    netto: rader.filter(r => r.momssats === sats).reduce((acc, r) => acc + r.antal * r.apris, 0),
    belopp: rader.filter(r => r.momssats === sats).reduce((acc, r) => acc + r.antal * r.apris * (sats / 100), 0),
  })).filter(m => m.belopp > 0);
  const totalInkl = totalExkl + momsByRate.reduce((s, m) => s + m.belopp, 0);

  const betalningsDagar = Math.round(
    (new Date(faktura.forfallo_datum).getTime() - new Date(faktura.faktura_datum).getTime()) / 86400000
  );

  async function buildPdfBlob(): Promise<Blob> {
    const { pdf } = await import('@react-pdf/renderer');
    const { FakturaPDF } = await import('@/components/FakturaPDF');
    const { createElement } = await import('react');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfDoc = pdf(createElement(FakturaPDF, {
      data: {
        faktura_nr: faktura!.faktura_nr,
        faktura_datum: faktura!.faktura_datum,
        leverans_datum: faktura!.leverans_datum,
        forfallo_datum: faktura!.forfallo_datum,
        status: faktura!.status,
        säljar_namn: profile?.full_name ?? '',
        säljar_foretag: profile?.company_name ?? null,
        säljar_org_nr: profile?.org_nr ?? null,
        säljar_adress: profile?.adress ?? null,
        säljar_postnummer: profile?.postnummer ?? null,
        säljar_ort: profile?.ort ?? null,
        säljar_momsnr: profile?.momsnr ?? null,
        betalningsinfo: faktura!.betalningsinfo,
        meddelande: faktura!.meddelande,
        kund_namn: faktura!.kund_namn,
        kund_email: faktura!.kund_email,
        kund_adress: faktura!.kund_adress,
        kund_postnummer: faktura!.kund_postnummer,
        kund_ort: faktura!.kund_ort,
        kund_land: faktura!.kund_land,
        kund_org_nr: faktura!.kund_org_nr,
        rader: faktura!.rader,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    return pdfDoc.toBlob();
  }

  async function handleDownload() {
    const blob = await buildPdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Faktura-${faktura!.faktura_nr}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSendEmail() {
    if (!sendEmail.trim()) return;
    setSending(true);
    setSendStatus('idle');
    setSendError(null);
    try {
      const blob = await buildPdfBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const res = await fetch('/api/fakturor/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendEmail.trim(),
          pdfBase64: base64,
          fakturaName: `Faktura-${faktura!.faktura_nr}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Okänt fel');
      setSendStatus('sent');
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Kunde inte skicka');
      setSendStatus('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
<div className="flex flex-col min-h-full bg-slate-50">

        {/* Kontrollpanel */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-4">
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
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
              style={{ backgroundColor: NAV_BG }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Ladda ner PDF
            </button>
          </div>

          {/* Skicka via e-post */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-slate-500 mb-3">Skicka faktura via e-post <span className="font-normal text-slate-400">(valfritt)</span></p>
            <div className="flex gap-2">
              <input
                type="email"
                value={sendEmail}
                onChange={e => { setSendEmail(e.target.value); setSendStatus('idle'); setSendError(null); }}
                placeholder={faktura.kund_email ?? 'mottagare@exempel.se'}
                className="flex-1 px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 transition-shadow"
                style={{ '--tw-ring-color': NAV_BG } as React.CSSProperties}
              />
              <button
                onClick={handleSendEmail}
                disabled={!sendEmail.trim() || sending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-40 transition-opacity whitespace-nowrap"
                style={{ backgroundColor: NAV_BG }}
              >
                {sending ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                {sending ? 'Skickar...' : 'Skicka'}
              </button>
            </div>
            {sendStatus === 'sent' && (
              <p className="mt-2 text-xs font-semibold" style={{ color: '#059669' }}>Fakturan skickades till {sendEmail}</p>
            )}
            {sendStatus === 'error' && (
              <p className="mt-2 text-xs font-semibold text-red-500">{sendError}</p>
            )}
          </div>
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
  momsByRate: { sats: number; netto: number; belopp: number }[];
  totalInkl: number;
  betalningsDagar: number;
  profile: { full_name: string | null; company_name: string | null; org_nr: string | null; adress: string | null; postnummer: string | null; ort: string | null; momsnr: string | null } | null;
}) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: NAV_BG, letterSpacing: '-0.5px' }}>FAKTURA</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Nr {faktura.faktura_nr}</div>
      </div>

      {/* Parter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Från</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{profile?.company_name ?? profile?.full_name ?? ''}</div>
          {profile?.company_name && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{profile.full_name}</div>}
          {profile?.org_nr && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Org-nr: {profile.org_nr}</div>}
          {profile?.adress && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{profile.adress}</div>}
          {(profile?.postnummer || profile?.ort) && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
              {[profile.postnummer, profile.ort].filter(Boolean).join(' ')}
            </div>
          )}
          {profile?.momsnr && <div style={{ fontSize: 12, color: '#64748b' }}>Moms-nr: {profile.momsnr}</div>}
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
        {([
          ['Fakturadatum', fmtDatum(faktura.faktura_datum)],
          ['Förfallodatum', fmtDatum(faktura.forfallo_datum)],
          ['Fakturanummer', faktura.faktura_nr],
          ['Betalningsvillkor', `${betalningsDagar} dagar`],
        ] as [string, string][]).map(([label, val]) => (
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
        <div style={{ width: 280 }}>
          {momsByRate.map(m => (
            <div key={m.sats}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#64748b' }}>
                <span>Beskattningsunderlag {m.sats}%</span><span style={{ fontWeight: 600, color: '#1e293b' }}>{fmt(m.netto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#64748b' }}>
                <span>Moms {m.sats}%</span><span style={{ fontWeight: 600, color: '#1e293b' }}>{fmt(m.belopp)}</span>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, color: '#64748b', borderTop: '1px solid #E2E8F0', marginTop: 4, paddingTop: 6 }}>
            <span>Totalt exkl. moms</span><span style={{ fontWeight: 600, color: '#1e293b' }}>{fmt(totalExkl)}</span>
          </div>
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
      <div style={{ marginTop: 48, paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', fontSize: 10, color: '#CBD5E1' }}>
        <span>Faktura {faktura.faktura_nr}</span>
      </div>
    </div>
  );
}
